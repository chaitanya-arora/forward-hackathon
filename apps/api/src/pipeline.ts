import { runExtraction, type UploadedDocument } from "./agent1/extract.js";
import { generateReport } from "./agent2/report.js";
import { completeJob, failJob, setDetail, setProgress, setStage } from "./jobs.js";
import type { ReportStore } from "./store.js";

/**
 * Agent 1 -> Agent 2. Stages are written at each real transition so the
 * processing screen shows actual progress, not a faked timer (spec §5).
 */
export async function runPipeline(
  jobId: string,
  documents: UploadedDocument[],
  store: ReportStore,
): Promise<void> {
  try {
    setStage(jobId, "reading documents");

    const extraction = await runExtraction(documents, (p) => {
      // The first progress messages are reads; once chunks start coming back
      // we're genuinely in extraction.
      if (p.chunksTotal === 0) {
        setStage(jobId, "reading documents", p.detail);
        return;
      }
      setStage(jobId, "extracting", p.detail);
      setProgress(jobId, {
        chunks_done: p.chunksDone,
        chunks_total: p.chunksTotal,
        evidence_found: p.evidenceFound,
      });
    });

    console.log(
      `[pipeline] ${jobId}: ${extraction.evidence.length} evidence items kept from ` +
        `${extraction.stats.chunks} chunks ` +
        `(dropped ${extraction.stats.droppedNotRelevant} not-relevant, ` +
        `${extraction.stats.droppedLowConfidence} below confidence threshold)`,
    );

    setStage(jobId, "analyzing pillars");
    const report = await generateReport(extraction, (detail) => setDetail(jobId, detail));

    setStage(jobId, "generating report");
    await store.save(report);

    completeJob(jobId, report);
    console.log(`[pipeline] ${jobId}: done — overall ${report.overall_readiness_score}/100`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] ${jobId}: failed —`, err);
    failJob(jobId, message);
  }
}
