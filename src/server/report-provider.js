import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const reportsRoot = fileURLToPath(new URL("../../storage/reports/", import.meta.url));
export class ReportError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function validRunIds(companyId, runId) {
  return [companyId, runId].every(id => Number.isSafeInteger(id) && id > 0);
}

export function createRepositoryReportProvider() {
  return async (companyId, runId) => {
    if (!validRunIds(companyId, runId)) throw new ReportError(404, "Run not found.");
    return getRepositoryRun(companyId, runId);
  };
}

// Serves the fixed demo id (company 2 / run 11) from saved JSON exports so
// "Example report" works without a seeded SQLite run. Any run actually
// started through this server (tracked in `liveRuns` in app.js) always reads
// live from SQLite regardless of which provider is passed to createApp.
export function createFileReportProvider(root = reportsRoot) {
  return async (companyId, runId) => {
    if (!validRunIds(companyId, runId)) throw new ReportError(404, "Run not found.");
    const directory = resolve(root, `company-${companyId}`, `run-${runId}`);
    try { await stat(directory); }
    catch (error) {
      if (error.code === "ENOENT") throw new ReportError(404, "Run not found.");
      throw new ReportError(500, "Saved reports could not be read.");
    }
    try {
      const [aasbS2Report, esgReport] = await Promise.all([
        "aasbS2Report.json", "esgReport.json",
      ].map(async name => JSON.parse(await readFile(resolve(directory, name), "utf8"))));
      for (const [report, type] of [[aasbS2Report, "AASB_S2_DRAFT"], [esgReport, "ESG_READINESS"]]) {
        const p = report?.presentation;
        if (report?.reportType !== type || typeof report.company !== "string" ||
          !p?.executiveSummary || !Array.isArray(p.keyFindings) || !Array.isArray(p.priorityActions)) {
          throw new Error("Invalid saved report");
        }
      }
      return { companyId, runId, stage: "completed", stageLabel: "completed", done: true,
        error: null, reportIds: { aasbS2: null, esg: null }, aasbS2Report, esgReport };
    } catch {
      throw new ReportError(500, "Saved reports are missing or invalid. Restore both report exports for this run.");
    }
  };
}

export async function getRepositoryRun(companyId, runId) {
  const { getRun, getAasbS2Report, getEsgReport } = await import("../database/repository.js");
  let run;
  try { run = getRun(companyId, runId); }
  catch { throw new ReportError(404, "Run not found."); }
  const stage = run.status === "failed" ? "failed" : run.stage ?? run.status;
  const done = stage === "completed" || stage === "failed";

  let aasbS2Report = null;
  let esgReport = null;
  try {
    if (done && stage !== "failed" && run.reportIds.aasbS2) aasbS2Report = getAasbS2Report(companyId, run.reportIds.aasbS2).report;
    if (done && stage !== "failed" && run.reportIds.esg) esgReport = getEsgReport(companyId, run.reportIds.esg).report;
  } catch {
    throw new ReportError(500, "Stored reports are missing or invalid in SQLite.");
  }

  return { companyId, runId, stage, stageLabel: stage.replaceAll("_", " "), done,
    error: stage === "failed" ? "Processing failed. Saved evidence is retained." : null,
    reportIds: run.reportIds,
    aasbS2Report,
    esgReport };
}
