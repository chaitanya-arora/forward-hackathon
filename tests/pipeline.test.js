import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { dirname } from "node:path";
import { exportCompletedReports } from "../src/pipeline/exportReports.js";
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
  const { aasbRubric } = await import("../src/aasb/rubric.js");
  const { createGeminiRequester } = await import("../src/llm/gemini.js");
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

    const callOrder=[];
    const agent1 = { client: { models: { async generateContent() {
      callOrder.push("extract");
      return { text: JSON.stringify({ pillar: "governance", confidence: 0.95, justification: "Board oversight" }) };
    } } } };
    const agent2 = { client: { models: { async generateContent(request) {
      callOrder.push("esg");
      const evidence = JSON.parse(request.contents).evidence;
      assert.equal(evidence[0].documentId, document.id);
      assert.equal(evidence[0].source, "board.pdf");
      assert.equal(evidence[0].sourceType, "public");
      return { text: JSON.stringify({ assessments: rubric.map((r) => ({
        criterionId: r.id, status: r.id === "governance.oversight" ? "partial" : "missing",
        citations: r.id === "governance.oversight" ? [{ excerptId: evidence[0].excerpts[0].excerptId }] : [],
        potentialInconsistency: false,
      })) }) };
    } } } };
    const aasb = { client: { models: { async generateContent(request) {
      callOrder.push("aasb");
      const evidence=JSON.parse(request.contents).evidence;
      assert.equal(evidence[0].documentId,document.id);
      return {text:JSON.stringify({assessments:aasbRubric.map(r=>({criterionId:r.id,
        status:r.id === "governance.responsibleBody" ? "partial" : "missing",
        citations:r.id === "governance.responsibleBody" ? [{excerptId:evidence[0].excerpts[0].excerptId}] : [],
      }))})};
    } } } };
    const result = await processCompany({ companyId: company.id, reportYear: "2025", documentIds: [document.id], reportingContext:{reportingPeriodStart:"2025-01-01"} }, { agent1, agent2, aasb });
    assert.deepEqual(callOrder,["extract","aasb","esg"]);
    assert.equal(result.outputs.esgReport.company, company.name);
    assert.equal(result.outputs.esgReport.aasbS2,undefined);
    assert.equal(result.outputs.aasbS2Report.standard.version,"2024-09");
    assert.equal(repo.getRun(company.id, result.runId).status, "completed");
    assert.equal(repo.getRun(company.id, result.runId).documents[0].evidence.pillars.governance.raw_text_chunks.length, 1);
    assert.deepEqual(repo.getEsgReport(company.id, result.reportIds.esg).report, result.outputs.esgReport);
    assert.deepEqual(repo.getAasbS2Report(company.id, result.reportIds.aasbS2).report, result.outputs.aasbS2Report);
    assert.ok(repo.getAasbS2Report(company.id,result.reportIds.aasbS2).report.presentation.executiveSummary);
    assert.ok(repo.getEsgReport(company.id,result.reportIds.esg).report.presentation.executiveSummary);
    const exported=await exportCompletedReports(result,join(directory,"exports"));
    assert.deepEqual((await readdir(dirname(exported.files.aasbS2Report))).sort(),["aasbS2Report.json","esgReport.json"]);
    for(const [key,path] of Object.entries(exported.files)) {
      const saved=JSON.parse(await readFile(path,"utf8"));
      assert.deepEqual(saved,result.outputs[key]);
      assert.ok(saved.presentation);assert.equal(saved.schemaVersion,"2.0");
    }
    assert.throws(() => repo.getEsgReport(other.id, result.reportIds.esg), /not found/);
    assert.throws(() => repo.getEsgReport(company.id, result.reportIds.aasbS2), /not found/);
    const snapshot=repo.getRun(company.id,result.runId).evidenceSnapshot;
    assert.deepEqual(result.outputs.aasbS2Report.evidenceRegister,snapshot.evidence);
    assert.deepEqual(result.outputs.esgReport.governance.evidence[0],snapshot.evidence[0]);
    assert.deepEqual(snapshot.evidence[0].pages,[1]);
    const badAgent2 = { client: { models: { async generateContent() { return { text: "invalid JSON" }; } } } };
    await assert.rejects(processCompany({ companyId: company.id, reportYear: "2025", documentIds: [document.id] }, { agent1, agent2: badAgent2, aasb }), /invalid/);
    const failed = repo.listRuns(company.id)[0];
    assert.equal(failed.status, "failed");
    assert.equal(repo.getRun(company.id, failed.id).reportId, null);
    assert.ok(repo.getRun(company.id,failed.id).reportIds.aasbS2);
    assert.equal(repo.getRun(company.id,failed.id).reportIds.esg,null);
    assert.ok(failed.finished_at);
    assert.ok(repo.getRun(company.id, failed.id).documents[0].evidence);
    assert.equal(db.prepare("SELECT count(*) AS n FROM report_outputs").get().n, 3);
    const badAasb = {client:{models:{async generateContent(){throw Error("AASB provider failed");}}}};
    await assert.rejects(processCompany({companyId:company.id,reportYear:"2025",documentIds:[document.id]}, {agent1,agent2,aasb:badAasb}), /AASB provider failed/);
    const aasbFailure=repo.listRuns(company.id)[0];
    assert.equal(aasbFailure.status,"failed");
    assert.equal(repo.getRun(company.id,aasbFailure.id).reportIds.aasbS2,null);
    assert.ok(repo.getRun(company.id,aasbFailure.id).documents[0].evidence);
    // Phase 2: real Agent 1 request integration, with a fake clock and exhausted quota.
    const second = repo.storeDocument({ ...input, filename:"second.pdf" });
    let fakeTime=0, quotaCalls=0, allow=false;
    const starts=[];
    const quotaError=Object.assign(new Error("RESOURCE_EXHAUSTED"),{status:429});
    const requester=createGeminiRequester({minIntervalMs:15000,maxRetries:2,random:()=>0,
      now:()=>fakeTime,sleep:async ms=>{fakeTime+=ms;}});
    const limitedAgent1={checkpoint:false,requester,client:{models:{async generateContent(){
      starts.push(fakeTime);quotaCalls++;
      if(!allow && quotaCalls>1)throw quotaError;
      return {text:JSON.stringify({pillar:"governance",confidence:0.95,justification:"Board oversight"})};
    }}}};
    await assert.rejects(processCompany({companyId:company.id,reportYear:"2025",documentIds:[document.id,second.id]},
      {agent1:limitedAgent1,agent2,aasb}),e=>e===quotaError);
    assert.deepEqual(starts,[0,15000,30000,45000]);
    const quotaRun=repo.getRun(company.id,repo.listRuns(company.id)[0].id);
    assert.equal(quotaRun.status,"failed");
    assert.ok(quotaRun.finished_at);
    assert.ok(quotaRun.documents[0].evidence);
    assert.equal(quotaRun.documents[1].evidence,null);
    assert.ok(repo.getDocument(company.id,second.id,true).content.length);
    allow=true;
    const retry=await processCompany({companyId:company.id,reportYear:"2025",documentIds:[document.id,second.id]},
      {agent1:limitedAgent1,agent2,aasb});
    assert.equal(retry.status,"completed");
    assert.notEqual(retry.runId,quotaRun.id);
    assert.ok(repo.getAasbS2Report(company.id,retry.reportIds.aasbS2));
    assert.ok(repo.getEsgReport(company.id,retry.reportIds.esg));

    // If SQLite cannot save failure status, retain the actual processing exception.
    const originalError=Object.freeze(new Error("Original failure"));
    let damagedRunId;
    db.exec("CREATE TEMP TRIGGER reject_failed BEFORE UPDATE ON pipeline_runs WHEN NEW.status='failed' BEGIN SELECT RAISE(ABORT,'simulated DB failure'); END");
    try {
      await assert.rejects(processCompany({companyId:company.id,reportYear:"2025",documentIds:[document.id]},
        {onRunCreated:id=>{damagedRunId=id;throw originalError;}}),e=>e===originalError);
    } finally {db.exec("DROP TRIGGER reject_failed");repo.failRun(damagedRunId);}
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    db.close();
    const reopened = new Database(databasePath, { readonly: true });
    assert.deepEqual(reopened.prepare("SELECT content FROM documents WHERE id=?").get(document.id).content, content);
    assert.deepEqual(JSON.parse(reopened.prepare("SELECT report_json FROM report_outputs WHERE id=?").get(result.reportIds.esg).report_json), result.outputs.esgReport);
    reopened.close();
  } finally {
    if (db.open) db.close();
    delete process.env.ESG_DB_PATH;
    await rm(directory, { recursive: true, force: true });
  }
});
