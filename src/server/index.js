/**
 * A thin, unbundled HTTP layer over the real pipeline in ../agent1, ../agent2,
 * ../aasb, ../database and ../pipeline. This file makes no assessment
 * decisions of its own — it only accepts uploads, kicks off processCompany(),
 * and reports back what the database already recorded.
 *
 * Run as plain Node (`node index.js`), never bundled: several of the modules
 * this imports resolve their own .env and SQLite paths from their real file
 * location via import.meta.url, and better-sqlite3 needs its native binding
 * loaded normally. A bundler that rewrites module locations or relies on
 * import.meta.url pointing somewhere else would break both.
 */
import cors from "cors";
import express from "express";
import multer from "multer";
import { createCompany, storeDocument, getRun, getAasbS2Report, getEsgReport } from "../database/repository.js";
import { processCompany } from "../pipeline/processCompany.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true }));
app.use(express.json());

app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, service: "forward-server" });
});

/**
 * One call does everything the frontend's upload screen needs: find-or-create
 * the company, store every uploaded document under it, and start a run.
 * Responds as soon as the run exists — processCompany keeps running in the
 * background and the client polls /runs/:runId for progress.
 */
app.post("/api/generate-report", upload.array("files"), async (req, res) => {
  try {
    const files = /** @type {Express.Multer.File[] | undefined} */ (req.files) ?? [];
    const companyName = typeof req.body?.companyName === "string" ? req.body.companyName.trim() : "";
    const reportYear = typeof req.body?.reportYear === "string" ? req.body.reportYear.trim() : "";

    if (!companyName) return res.status(400).json({ error: "companyName is required." });
    if (!/^\d{4}$/.test(reportYear)) return res.status(400).json({ error: "reportYear must be a four-digit year." });
    if (files.length === 0) return res.status(400).json({ error: "No files uploaded." });

    const rawSourceTypes = req.body?.sourceTypes;
    const sourceTypes = Array.isArray(rawSourceTypes) ? rawSourceTypes : rawSourceTypes ? [rawSourceTypes] : [];

    const company = createCompany(companyName);
    const documentIds = files.map((file, i) => {
      const sourceType = ["public", "internal", "unknown"].includes(sourceTypes[i]) ? sourceTypes[i] : "unknown";
      const doc = storeDocument({
        companyId: company.id, reportYear, filename: file.originalname, sourceType, content: file.buffer,
      });
      return doc.id;
    });

    let runId;
    const finished = processCompany(
      { companyId: company.id, reportYear, documentIds },
      { onRunCreated: (id) => { runId = id; } },
    );
    // The run is already visible in the database once onRunCreated fires;
    // respond immediately rather than holding the connection open for what
    // can now be several minutes of rate-limited Gemini calls.
    finished.catch((error) => {
      console.error(`[server] run ${error?.runId ?? runId} failed:`, error.message);
    });

    // onRunCreated fires synchronously before any await inside processCompany,
    // so runId is already set by the time we get here.
    res.json({ companyId: company.id, runId });
  } catch (error) {
    console.error("[server] generate-report failed:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed." });
  }
});

const STAGE_MAP = {
  extracting: "extracting",
  aasb_analysing: "analysing AASB S2",
  esg_analysing: "analysing ESG",
  completed: "completed",
  failed: "failed",
};

app.get("/api/companies/:companyId/runs/:runId", (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const runId = Number(req.params.runId);
    const run = getRun(companyId, runId);
    const stage = run.status === "failed" ? "failed" : run.stage ?? run.status;
    const done = stage === "completed" || stage === "failed";

    let aasbS2Report = null;
    let esgReport = null;
    if (done && run.status !== "failed") {
      if (run.reportIds.aasbS2) aasbS2Report = getAasbS2Report(companyId, run.reportIds.aasbS2).report;
      if (run.reportIds.esg) esgReport = getEsgReport(companyId, run.reportIds.esg).report;
    }

    res.json({
      companyId, runId, stage, stageLabel: STAGE_MAP[stage] ?? stage, done,
      error: run.status === "failed" ? run.error ?? "Processing failed." : null,
      reportIds: run.reportIds, aasbS2Report, esgReport,
    });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Run not found." });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});
