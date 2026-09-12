import { runExtraction, type UploadedDocument } from "./agent1/extract.js";
import { generateReport } from "./agent2/report.js";
import { completeJob, failJob, setDetail, setStage } from "./jobs.js";
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

    const extraction = await runExtraction(documents, (detail) => {
      // The first progress messages are reads; once chunks start coming back
      // we're genuinely in extraction.
      if (detail.startsWith("Reading")) setStage(jobId, "reading documents", detail);
      else setStage(jobId, "extracting", detail);
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
