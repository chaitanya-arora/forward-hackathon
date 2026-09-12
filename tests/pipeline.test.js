import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

function examplePDF() {
  const content = "BT /F1 12 Tf 40 750 Td (The board reviews climate risks quarterly.) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i+1} 0 obj\n${object}\nendobj\n`;
  }
  const offset = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("stored uploads flow through both agents with ownership, provenance, history and failure retention", async () => {
  const directory = await mkdtemp(join(tmpdir(), "esg-pipeline-test-"));
  const databasePath = join(directory, "test.db");
  process.env.ESG_DB_PATH = databasePath;
  const { db } = await import("../src/database/db.js");
  const repo = await import("../src/database/repository.js");
  const { processCompany } = await import("../src/pipeline/processCompany.js");
  const { rubric } = await import("../src/agent2/rubric.js");
  try {
    const company = repo.createCompany("Fixture Company");
    assert.equal(repo.createCompany(" fixture company ").id, company.id);
    const other = repo.createCompany("Other Company");
    const content = examplePDF();
    const input = { companyId: company.id, reportYear: "2025", filename: "board.pdf", sourceType: "public", content };
    const document = repo.storeDocument(input);
    assert.equal(repo.storeDocument(input).duplicate, true);
    assert.deepEqual(repo.getDocument(company.id, document.id, true).content, content);
    assert.equal(repo.listDocuments(company.id, "2025")[0].content, undefined);
    assert.throws(() => repo.getDocument(other.id, document.id), /not found/);
    assert.throws(() => repo.createRun(other.id, "2025", [document.id]), /not found/);
    assert.throws(() => repo.createRun(company.id, "2024", [document.id]), /year/);
    assert.equal(repo.listRuns(company.id).length, 0);
    assert.throws(() => repo.storeDocument({ ...input, content: Buffer.alloc(0) }));
    assert.throws(() => repo.storeDocument({ ...input, content: Buffer.alloc(repo.MAX_DOCUMENT_BYTES + 1) }));
    const unsupported = repo.storeDocument({ ...input, filename: "notes.docx", content: Buffer.from("stored original bytes") });
    await assert.rejects(processCompany({ companyId: company.id, reportYear: "2025", documentIds: [unsupported.id] }), /only PDFs/);
    assert.equal(repo.listRuns(company.id)[0].status, "failed");
    assert.ok(repo.getDocument(company.id, unsupported.id, true).content.length);

    const agent1 = { client: { models: { async generateContent() {
      return { text: JSON.stringify({ pillar: "governance", confidence: 0.95, justification: "Board oversight" }) };
    } } } };
    const agent2 = { client: { models: { async generateContent(request) {
      const evidence = JSON.parse(request.contents).evidence;
      assert.equal(evidence[0].documentId, document.id);
      assert.equal(evidence[0].source, "board.pdf");
      assert.equal(evidence[0].sourceType, "public");
      return { text: JSON.stringify({ assessments: rubric.map((r) => ({
        criterionId: r.id, status: r.id === "governance.oversight" ? "partial" : "missing",
        citations: r.id === "governance.oversight" ? [{ evidenceId: evidence[0].id, quote: "The board reviews climate risks quarterly." }] : [],
        potentialInconsistency: false,
      })) }) };
    } } } };
    const result = await processCompany({ companyId: company.id, reportYear: "2025", documentIds: [document.id] }, { agent1, agent2 });
    assert.equal(result.report.company, company.name);
    assert.equal(repo.getRun(company.id, result.runId).status, "completed");
    assert.equal(repo.getRun(company.id, result.runId).documents[0].evidence.pillars.governance.raw_text_chunks.length, 1);
    assert.deepEqual(repo.getReport(company.id, result.id).report, result.report);
    assert.throws(() => repo.getReport(other.id, result.id), /not found/);
    const badAgent2 = { client: { models: { async generateContent() { return { text: "invalid JSON" }; } } } };
    await assert.rejects(processCompany({ companyId: company.id, reportYear: "2025", documentIds: [document.id] }, { agent1, agent2: badAgent2 }), /invalid/);
    const failed = repo.listRuns(company.id)[0];
    assert.equal(failed.status, "failed");
    assert.equal(repo.getRun(company.id, failed.id).reportId, null);
    assert.ok(repo.getRun(company.id, failed.id).documents[0].evidence);
    assert.equal(db.prepare("SELECT count(*) AS n FROM reports").get().n, 1);
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    db.close();
    const reopened = new Database(databasePath, { readonly: true });
    assert.deepEqual(reopened.prepare("SELECT content FROM documents WHERE id=?").get(document.id).content, content);
    assert.deepEqual(JSON.parse(reopened.prepare("SELECT report_json FROM reports WHERE id=?").get(result.id).report_json), result.report);
    reopened.close();
  } finally {
    if (db.open) db.close();
    delete process.env.ESG_DB_PATH;
    await rm(directory, { recursive: true, force: true });
  }
});
