import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app.js";
import { createFileReportProvider } from "../report-provider.js";
import { createCompany, createRun, failRunWithCode, storeDocument } from "../../database/repository.js";

async function serve(t, provider, pdfRenderer) {
  const server = createApp({ ...(provider ? { reportProvider: provider } : {}), ...(pdfRenderer ? { pdfRenderer } : {}) }).listen(0, "127.0.0.1");
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
  assert.equal(typeof run.reportIds.esg, "number");
  assert.ok(run.aasbS2Report?.presentation?.executiveSummary?.headline);
  assert.ok(run.esgReport?.presentation?.executiveSummary?.headline);
  for (const name of ["aasbS2Report", "esgReport"]) {
    assert.ok(Array.isArray(run[name].presentation.keyFindings));
    assert.ok(Array.isArray(run[name].presentation.priorityActions));
  }
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

test("company 2 run 11 exports both stored reports as PDFs", async t => {
  const url = await serve(t);
  for (const type of ["aasb", "esg"]) {
    const response = await fetch(`${url}/api/companies/2/runs/11/reports/${type}/pdf`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("content-disposition"), new RegExp(`${type === "aasb" ? "aasb-s2" : "esg"}-readiness-report\\.pdf`));
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 1000);
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  }
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
