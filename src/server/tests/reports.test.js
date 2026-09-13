import test, { after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileReportProvider } from "../report-provider.js";
// Select a disposable database before importing any repository/application code.
const databaseDirectory = await mkdtemp(join(tmpdir(), "forward-server-tests-"));
process.env.ESG_DB_PATH = join(databaseDirectory, "test.db");
const { createCompany, createRun, failRunWithCode, storeDocument, saveTypedReport, setRunStage } = await import("../../database/repository.js");
const { db } = await import("../../database/db.js");
const { createApp } = await import("../app.js");
after(async () => { db.close(); delete process.env.ESG_DB_PATH; await rm(databaseDirectory, { recursive: true, force: true }); });
createCompany("Reserved fixture");
const fixtureCompany = createCompany("Regression fixture");
const fixtureDocument = storeDocument({ companyId: fixtureCompany.id, reportYear: "2026", filename: "fixture.pdf", content: Buffer.from("%PDF-1.7 fixture") });
let fixtureRun;
for (let i = 0; i < 11; i++) fixtureRun = createRun(fixtureCompany.id, "2026", [fixtureDocument.id]);
const fixtureReport = JSON.parse(await readFile(new URL("../../../storage/reports/company-2/run-11/aasbS2Report.json", import.meta.url), "utf8"));
saveTypedReport(fixtureRun, "aasb_s2", fixtureReport);
setRunStage(fixtureRun, "completed");
import { buildAasbPdfViewModel } from "../aasb-pdf-view-model.js";

async function serve(t, provider, pdfRenderer, processRunner) {
  const server = createApp({ ...(provider ? { reportProvider: provider } : {}), ...(pdfRenderer ? { pdfRenderer } : {}), processRunner }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("health, SQLite-backed run 11, CORS and controlled invalid-run responses over HTTP", async t => {
  const url = await serve(t);
  assert.deepEqual(await (await fetch(`${url}/api/ping`)).json(), { ok: true, service: "forward-server" });
  const response = await fetch(`${url}/api/companies/2/runs/11`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  const run = await response.json();
  assert.equal(run.stage, "completed");
  assert.equal(typeof run.reportIds.aasbS2, "number");
  assert.equal(run.reportIds.esg, null);
  assert.ok(run.aasbS2Report?.presentation?.executiveSummary?.headline);
  assert.equal(run.esgReport, null);
  assert.ok(Array.isArray(run.aasbS2Report.presentation.keyFindings));
  assert.ok(Array.isArray(run.aasbS2Report.presentation.priorityActions));
  for (const ids of ["0/11", "2/no", "999999/11", "3/11", "2/999999", "9007199254740992/11"]) {
    const [company, id] = ids.split("/");
    const invalid = await fetch(`${url}/api/companies/${company}/runs/${id}`);
    assert.equal(invalid.status, 404);
    assert.deepEqual(await invalid.json(), { error: "Run not found." });
  }
  const disallowed = await fetch(`${url}/api/ping`, { headers: { Origin: "http://unapproved.example" } });
  assert.equal(disallowed.headers.get("access-control-allow-origin"), null);
});

test("missing, malformed and wrong-shaped exports return controlled server errors", async t => {
  const root = await mkdtemp(join(tmpdir(), "forward-report-provider-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, "company-2", "run-11");
  await mkdir(dir, { recursive: true });
  const url = await serve(t, createFileReportProvider(root));
  const request = async () => {
    const response = await fetch(`${url}/api/companies/2/runs/11`);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { error: "Saved reports are missing or invalid. Restore both report exports for this run." });
  };
  await request();
  await writeFile(join(dir, "aasbS2Report.json"), "not JSON");
  await writeFile(join(dir, "esgReport.json"), "{}");
  await request();
  await writeFile(join(dir, "aasbS2Report.json"), "{}");
  await request();
});

test("unexpected provider errors never expose internal messages", async t => {
  const url = await serve(t, async () => { throw new Error("private internal path and stack"); });
  const response = await fetch(`${url}/api/companies/2/runs/11`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Reports could not be loaded." });
});

test("failed runs expose safe quota and generic error codes", async t => {
  const company = createCompany(`Error contract ${Date.now()}-${Math.random()}`);
  const document = storeDocument({ companyId: company.id, reportYear: "2026", filename: "source.pdf", content: Buffer.from("%PDF-1.7 test") });
  const quotaRunId = createRun(company.id, "2026", [document.id]);
  failRunWithCode(quotaRunId, "AI_QUOTA_EXHAUSTED");
  const genericRunId = createRun(company.id, "2026", [document.id]);
  failRunWithCode(genericRunId, "PROCESSING_FAILED");
  const url = await serve(t);

  const quotaResponse = await fetch(`${url}/api/companies/${company.id}/runs/${quotaRunId}`);
  assert.equal(quotaResponse.status, 200);
  assert.deepEqual((await quotaResponse.json()).error, {
    code: "AI_QUOTA_EXHAUSTED",
    message: "AI processing is temporarily unavailable because the service has reached its current usage limit. Please try again later.",
  });

  const genericResponse = await fetch(`${url}/api/companies/${company.id}/runs/${genericRunId}`);
  assert.equal(genericResponse.status, 200);
  assert.deepEqual((await genericResponse.json()).error, {
    code: "PROCESSING_FAILED",
    message: "Processing failed. Saved evidence is retained.",
  });
});

test("company 2 run 11 exports the stored AASB report as a PDF", async t => {
  const url = await serve(t);
  const response = await fetch(`${url}/api/companies/2/runs/11/reports/aasb/pdf`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition"), /aasb-s2-readiness-report\.pdf/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 1000);
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await task.promise;
  try {
    assert.ok(pdf.numPages >= 3 && pdf.numPages <= 20);
    let allText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const text = items.map(item => item.str ?? "").join(" ");
      assert.ok(text.length > 150, "No footer-only or accidental blank pages");
      assert.equal(text.match(/Draft evidence readiness/g)?.length, 1);
      assert.ok(text.includes("Page " + pageNumber + " of " + pdf.numPages));
      allText += text;
    }
    assert.doesNotMatch(allText, /responsibleBody|targetDescription|identifiedRisks|requires_human_|evidenceIds|\{\s*"|\bESG\b/);
    for (const label of ["Governance", "Strategy", "Risk Management", "Metrics & Targets", "General Requirements"]) assert.ok(allText.includes(label));
  } finally { await task.destroy(); }
  const legacyEsg = await fetch(`${url}/api/companies/2/runs/11/reports/esg/pdf`);
  assert.equal(legacyEsg.status, 404);
});

test("AASB PDF view model hides internal keys and consolidates actions", async () => {
  const { getAasbS2Report, getRun } = await import("../../database/repository.js");
  const savedRun = getRun(2, 11);
  const view = buildAasbPdfViewModel(getAasbS2Report(2, savedRun.reportIds.aasbS2).report);
  assert.ok(view.priorityActions.length <= 7);
  assert.equal(JSON.stringify(view).includes("responsibleBody"), false);
  assert.equal(JSON.stringify(view).includes("metricsAndTargets.scope1"), false);
  assert.ok(view.sectionSummary.every((section) => typeof section.status === "string"));
});

test("PDF endpoint returns controlled 404s and does not alter a run", async t => {
  const url = await serve(t);
  const missingType = await fetch(`${url}/api/companies/2/runs/11/reports/missing/pdf`);
  assert.equal(missingType.status, 404);
  assert.deepEqual(await missingType.json(), { error: "Report type not found." });
  const missingRun = await fetch(`${url}/api/companies/2/runs/999999/reports/aasb/pdf`);
  assert.equal(missingRun.status, 404);
  assert.deepEqual(await missingRun.json(), { error: "Run not found." });
  const run = await (await fetch(`${url}/api/companies/2/runs/11`)).json();
  assert.equal(run.stage, "completed");
});

test("PDF renderer failures return a controlled 500 and leave the run completed", async t => {
  const url = await serve(t, undefined, async () => { throw new Error("private renderer internals"); });
  const response = await fetch(`${url}/api/companies/2/runs/11/reports/aasb/pdf`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "PDF could not be generated." });
  const run = await (await fetch(`${url}/api/companies/2/runs/11`)).json();
  assert.equal(run.stage, "completed");
});

test("PDF transformation is deterministic and preserves the canonical report", () => {
  const before = JSON.stringify(fixtureReport);
  const first = buildAasbPdfViewModel(fixtureReport);
  assert.deepEqual(first, buildAasbPdfViewModel(fixtureReport));
  assert.equal(JSON.stringify(fixtureReport), before);
  assert.equal(first.executiveSummary.readinessScore, fixtureReport.aasbS2ReadinessScore);
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  assert.deepEqual(first.priorityActions.map(a => rank[a.priority]), first.priorityActions.map(a => rank[a.priority]).sort((a,b) => a-b));
  assert.equal(first.detailedSections.flatMap(s => s.criteria).length, 64);
});

test("multipart upload returns a persisted run before processing finishes, then exposes safe failure", async t => {
  let rejectProcessing;
  let received;
  const url = await serve(t, undefined, undefined, (input, { onRunCreated }) => {
    received = input;
    const runId = createRun(input.companyId, input.reportYear, input.documentIds);
    onRunCreated(runId);
    return new Promise((_resolve, reject) => { rejectProcessing = () => {
      failRunWithCode(runId, "AI_QUOTA_EXHAUSTED");
      reject(new Error("Simulated quota failure"));
    }; });
  });
  const invalid = await fetch(`${url}/api/generate-report`, { method: "POST", body: new FormData() });
  assert.equal(invalid.status, 400);
  const form = new FormData();
  form.append("companyName", "Upload fixture");
  form.append("reportYear", "2025");
  form.append("sourceTypes", "public");
  form.append("files", new Blob(["%PDF-1.7 synthetic upload"], { type: "application/pdf" }), "fixture.pdf");
  const response = await fetch(`${url}/api/generate-report`, { method: "POST", body: form, signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  const ids = await response.json();
  assert.equal(ids.companyId, received.companyId);
  assert.equal(received.documentIds.length, 1);
  const { getDocument } = await import("../../database/repository.js");
  assert.equal(getDocument(ids.companyId, received.documentIds[0], true).content.toString(), "%PDF-1.7 synthetic upload");
  const runUrl = `${url}/api/companies/${ids.companyId}/runs/${ids.runId}`;
  assert.equal((await (await fetch(runUrl)).json()).done, false);
  rejectProcessing();
  const failed = await (await fetch(runUrl)).json();
  assert.equal(failed.stage, "failed");
  assert.equal(failed.error.code, "AI_QUOTA_EXHAUSTED");
});
