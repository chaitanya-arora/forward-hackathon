import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const reportsRoot = fileURLToPath(new URL("../../storage/reports/", import.meta.url));

export async function exportCompletedReports(result, root = reportsRoot) {
  const directory = resolve(root, `company-${result.companyId}`, `run-${result.runId}`);
  const files = {
    aasbS2Report: resolve(directory, "aasbS2Report.json"),
    esgReport: resolve(directory, "esgReport.json"),
  };
  try {
    await mkdir(directory, { recursive: true });
    for (const [key, path] of Object.entries(files)) {
      await writeFile(path, JSON.stringify(result.outputs[key], null, 2) + "\n", "utf8");
    }
  } catch (error) {
    throw new Error(`Run ${result.runId} completed and its reports are saved in SQLite, but file export failed: ${error.message}. Use export-aasb ${result.companyId} ${result.reportIds.aasbS2} and export-esg ${result.companyId} ${result.reportIds.esg} to retry export without regenerating reports.`);
  }
  return { companyId: result.companyId, runId: result.runId, status: result.status, reportIds: result.reportIds, files };
}
