import { db } from "../database/db.js";
import { createRun, getCompany, getDocument, getReport, listDocuments } from "../database/repository.js";
import { extractEvidence } from "../agent1/agent1.js";
import { generateESGReport } from "../agent2/generateESGReport.js";

// A future HTTP handler/worker can call this service without invoking either CLI.
export async function processCompany({ companyId, reportYear, documentIds }, options = {}) {
  const company = getCompany(companyId);
  const ids = documentIds ?? listDocuments(companyId, reportYear).map((doc) => doc.id);
  const runId = createRun(companyId, reportYear, ids);
  try {
    options.onRunCreated?.(runId);
    const combined = { company_name: company.name, report_year: String(reportYear), pillars: {} };
    for (const key of ["governance", "strategy", "risk_management", "metrics_targets"]) {
      combined.pillars[key] = { raw_text_chunks: [], source_pages: [] };
    }
    // Validate all formats before spending tokens on any selected document.
    for (const id of ids) {
      if (getDocument(companyId, id).mime_type !== "application/pdf") throw new Error(`Document ${id} is stored, but only PDFs can currently be extracted.`);
    }
    for (const id of ids) {
      const document = getDocument(companyId, id, true);
      const evidence = await extractEvidence(document.content, company.name, String(reportYear), options.agent1);
      // Preserve exact Agent 1 output for audit; enrich the combined input with provenance.
      db.prepare("UPDATE run_documents SET evidence_json=? WHERE run_id=? AND document_id=?").run(JSON.stringify(evidence), runId, id);
      for (const [key, group] of Object.entries(evidence.pillars)) {
        combined.pillars[key].raw_text_chunks.push(...group.raw_text_chunks.map((chunk) => ({
          ...chunk, source: document.filename, sourceType: document.source_type, documentId: id,
          pillarSourcePages: group.source_pages,
        })));
        combined.pillars[key].source_pages.push(...group.source_pages);
      }
    }
    for (const group of Object.values(combined.pillars)) group.source_pages = [...new Set(group.source_pages)].sort((a,b) => a-b);
    db.prepare("UPDATE pipeline_runs SET status='analysing' WHERE id=?").run(runId);
    const report = await generateESGReport(combined, options.agent2);
    const reportId = db.transaction(() => {
      const id = Number(db.prepare("INSERT INTO reports(run_id,report_json) VALUES (?,?)").run(runId, JSON.stringify(report)).lastInsertRowid);
      db.prepare("UPDATE pipeline_runs SET status='completed',finished_at=CURRENT_TIMESTAMP WHERE id=?").run(runId);
      return id;
    })();
    return { companyId, runId, ...getReport(companyId, reportId) };
  } catch (error) {
    // Do not persist raw provider errors that might contain request details.
    db.prepare("UPDATE pipeline_runs SET status='failed',error=?,finished_at=CURRENT_TIMESTAMP WHERE id=?")
      .run("Processing failed. Original uploads and completed extraction results are retained; retry as a new run.", runId);
    error.runId = runId;
    throw error;
  }
}
