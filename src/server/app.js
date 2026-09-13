import cors from "cors";
import express from "express";
import multer from "multer";
import { createRepositoryReportProvider, getRepositoryRun, ReportError, validRunIds } from "./report-provider.js";
import { getAasbS2Report, getEsgReport, getRun } from "../database/repository.js";
import { renderReportPdf } from "./pdf-renderer.js";

function downloadName(company, type) {
  const safeCompany = String(company).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").toLowerCase() || "company";
  return `${safeCompany}-${type === "aasb" ? "aasb-s2-readiness" : "esg-readiness"}-report.pdf`;
}

export function createApp({ reportProvider = createRepositoryReportProvider(), corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000", pdfRenderer = renderReportPdf } = {}) {
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

  app.get("/api/companies/:companyId/runs/:runId/reports/:reportType/pdf", async (req, res) => {
    const companyId = Number(req.params.companyId), runId = Number(req.params.runId);
    const reportType = req.params.reportType;
    if (!/^\d+$/.test(req.params.companyId) || !/^\d+$/.test(req.params.runId) || !validRunIds(companyId, runId)) {
      return res.status(404).json({ error: "Run not found." });
    }
    if (!["aasb", "esg"].includes(reportType)) return res.status(404).json({ error: "Report type not found." });
    try {
      let run;
      try { run = getRun(companyId, runId); }
      catch { throw new ReportError(404, "Run not found."); }
      if (run.status !== "completed") return res.status(404).json({ error: "Report is not available for this run." });
      const reportId = reportType === "aasb" ? run.reportIds.aasbS2 : run.reportIds.esg;
      if (!reportId) return res.status(404).json({ error: "Report is not available for this run." });
      const report = (reportType === "aasb" ? getAasbS2Report : getEsgReport)(companyId, reportId).report;
      const pdf = await pdfRenderer(report);
      res.set({ "Content-Type": "application/pdf", "Content-Length": pdf.length, "Content-Disposition": `attachment; filename="${downloadName(report.company, reportType)}"`, "Cache-Control": "no-store" });
      return res.send(pdf);
    } catch (error) {
      if (error?.status !== 404) console.error(`[server] PDF render failed for ${companyId}/${runId}/${reportType}:`, error?.message);
      return res.status(error?.status === 404 ? 404 : 500).json({ error: error?.status === 404 ? error.message : "PDF could not be generated." });
    }
  });
  app.use((error, _req, res, _next) => {
    res.status(400).json({ error: "Upload could not be accepted. Check file size and format." });
  });
  return app;
}
