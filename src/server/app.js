import cors from "cors";
import express from "express";
import multer from "multer";
import { createFileReportProvider, getRepositoryRun, validRunIds } from "./report-provider.js";


export function createApp({ reportProvider = createFileReportProvider(), corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000" } = {}) {
  const app = express();
  const liveRuns = new Set();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

  app.use(cors({ origin: corsOrigin.split(",").map((s) => s.trim()) }));
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

      const { createCompany, storeDocument } = await import("../database/repository.js");
      const { processCompany } = await import("../pipeline/processCompany.js");
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
      finished.then(async result => {
        const { exportCompletedReports } = await import("../pipeline/exportReports.js");
        await exportCompletedReports(result);
      }).catch((error) => {
        console.error(`[server] run ${error?.runId ?? runId} failed:`, error.message);
      });

      // onRunCreated fires synchronously before any await inside processCompany,
      // so runId is already set by the time we get here.
      if (!runId) throw new Error("Unable to start run.");
      liveRuns.add(`${company.id}/${runId}`);
      res.json({ companyId: company.id, runId });
    } catch (error) {
      console.error("[server] generate-report failed:", error);
      res.status(400).json({ error: "Unable to start processing. Check the upload and server configuration." });
    }
  });

  app.get("/api/companies/:companyId/runs/:runId", async (req, res) => {
    const companyId = Number(req.params.companyId), runId = Number(req.params.runId);
    if (!/^\d+$/.test(req.params.companyId) || !/^\d+$/.test(req.params.runId) || !validRunIds(companyId, runId)) {
      return res.status(404).json({ error: "Run not found." });
    }
    try {
      const provider = liveRuns.has(companyId + "/" + runId) ? getRepositoryRun : reportProvider;
      res.set("Cache-Control", "no-store").json(await provider(companyId, runId));
    } catch (error) {
      const status = [404, 500].includes(error.status) ? error.status : 500;
      res.status(status).json({ error: error.status ? error.message : "Reports could not be loaded." });
    }
  });
  app.use((error, _req, res, _next) => {
    res.status(400).json({ error: "Upload could not be accepted. Check file size and format." });
  });
  return app;
}
