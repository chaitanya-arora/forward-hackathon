import { db } from "../database/db.js";
import { extractionCheckpoint } from "../database/extractionCheckpoint.js";
import { createRun, getCompany, getDocument, listDocuments, saveTypedReport, setRunStage, failRun } from "../database/repository.js";
import { extractEvidence } from "../agent1/agent1.js";
import { generateESGFromNormalized } from "../agent2/generateESGReport.js";
import { normalizeEvidence } from "../agent2/normalizeEvidence.js";
import { generateAasbS2FromNormalized } from "../aasb/generateAasbS2Report.js";
import { prepareContext } from "../aasb/context.js";

// A future HTTP handler/worker can call this service without invoking either CLI.
export async function processCompany({ companyId, reportYear, documentIds, reportingContext = {} }, options = {}) {
  const company = getCompany(companyId);
  const ids = documentIds ?? listDocuments(companyId, reportYear).map((doc) => doc.id);
  const context = prepareContext(reportingContext);
  const runId = createRun(companyId, reportYear, ids, context);
  try {
    options.onRunCreated?.(runId);
    setRunStage(runId, "extracting");
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
      const evidence = await extractEvidence(document.content, company.name, String(reportYear), {
        ...options.agent1,
        checkpoint: options.agent1?.checkpoint === false ? undefined : extractionCheckpoint(db, id),
      });
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
    const normalized = normalizeEvidence(combined);
    setRunStage(runId, "aasb_analysing", normalized);
    const aasbS2Report = await generateAasbS2FromNormalized(normalized, context, options.aasb);
    const aasbId = saveTypedReport(runId, "aasb_s2", aasbS2Report);
    setRunStage(runId, "esg_analysing");
    const esgReport = await generateESGFromNormalized(normalized, options.agent2);
    const esgId = db.transaction(() => {
      const id = saveTypedReport(runId, "esg", esgReport);
      setRunStage(runId, "completed");
      return id;
    })();
    return { companyId, runId, status: "completed", reportIds: { aasbS2: aasbId, esg: esgId },
      outputs: { aasbS2Report, esgReport } };
  } catch (error) {
    // Do not persist raw provider errors that might contain request details.
    try { failRun(runId); } catch { console.error(`Unable to persist failed status for run ${runId}; original processing error follows.`); }
    try { if (error && typeof error === "object") error.runId = runId; } catch { /* Rethrow even frozen provider errors unchanged. */ }
    throw error;
  }
}
