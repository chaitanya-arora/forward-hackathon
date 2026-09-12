import cors from "cors";
import express from "express";
import multer from "multer";
import { getJob, createJob } from "./jobs.js";
import { runPipeline } from "./pipeline.js";
import { createStore } from "./store.js";
import type { UploadedDocument } from "./agent1/extract.js";

const app = express();
const store = createStore();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true,
  }),
);
app.use(express.json());

app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, service: "climate-api" });
});

/**
 * Multipart upload of any number of documents, with an optional free-text
 * label per file (spec §6). Files are processed then discarded — only the
 * extracted evidence persists.
 */
app.post("/api/generate-report", upload.array("files"), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (files.length === 0) {
    res.status(400).json({ error: "No files uploaded." });
    return;
  }

  // `labels` arrives as a repeated field, positionally matched to `files`.
  const rawLabels = req.body?.labels;
  const labels: string[] = Array.isArray(rawLabels)
    ? rawLabels
    : typeof rawLabels === "string"
      ? [rawLabels]
      : [];

  const documents: UploadedDocument[] = files.map((file, i) => ({
    filename: file.originalname,
    label: labels[i]?.trim() || "Company-provided document",
    buffer: file.buffer,
  }));

  const jobId = createJob();
  res.json({ jobId });

  // Kick the pipeline off without awaiting — the client polls for progress.
  void runPipeline(jobId, documents, store);
});

app.get("/api/report/status/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Unknown job." });
    return;
  }
  res.json(job);
});

app.get("/api/report/latest", async (_req, res) => {
  const report = await store.latest();
  if (!report) {
    res.status(404).json({ error: "No report has been generated yet." });
    return;
  }
  res.json(report);
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[api] listening on :${port}`);
});
