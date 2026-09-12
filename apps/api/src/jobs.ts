import { randomUUID } from "node:crypto";
import type { JobStage, JobStatus, Report } from "@climate/contract";

/**
 * In-memory job state. Single process, no history required — a database
 * round-trip on every 2s poll would buy nothing. Only the finished report
 * is persisted, via the store.
 */
interface Job {
  jobId: string;
  stage: JobStage;
  detail?: string;
  error?: string;
  result?: Report;
  createdAt: number;
}

const jobs = new Map<string, Job>();
const MAX_JOBS = 20;

export function createJob(): string {
  const jobId = randomUUID();
  jobs.set(jobId, { jobId, stage: "queued", createdAt: Date.now() });

  // Keep the map from growing without bound over a long demo session.
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) jobs.delete(oldest.jobId);
  }

  return jobId;
}

export function setStage(jobId: string, stage: JobStage, detail?: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.stage = stage;
  job.detail = detail;
}

export function setDetail(jobId: string, detail: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.detail = detail;
}

export function completeJob(jobId: string, result: Report): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.stage = "done";
  job.detail = undefined;
  job.result = result;
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.stage = "error";
  job.error = error;
}

export function getJob(jobId: string): JobStatus | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    jobId: job.jobId,
    stage: job.stage,
    detail: job.detail,
    done: job.stage === "done" || job.stage === "error",
    error: job.error,
    result: job.result,
  };
}
