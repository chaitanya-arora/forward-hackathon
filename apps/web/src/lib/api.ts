import type { JobStatus, Report } from "@climate/contract";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function startReport(
  files: Array<{ file: File; label: string }>,
): Promise<{ jobId: string }> {
  const form = new FormData();
  for (const { file, label } of files) {
    form.append("files", file);
    form.append("labels", label);
  }

  const res = await fetch(`${API_URL}/api/generate-report`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Upload failed.");
  return res.json();
}

export async function fetchStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_URL}/api/report/status/${jobId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not read job status.");
  return res.json();
}

export async function fetchLatest(): Promise<Report | null> {
  const res = await fetch(`${API_URL}/api/report/latest`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not load the latest report.");
  return res.json();
}
