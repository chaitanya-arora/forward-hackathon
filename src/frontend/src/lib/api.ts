import type { RunStatus } from "@/lib/assessment-types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface UploadEntry {
  file: File;
  sourceType: "public" | "internal" | "unknown";
}

/**
 * Starts a real processCompany() run: creates/finds the company, stores every
 * uploaded document under it for reportYear, and kicks off extraction + both
 * report generators. Returns as soon as the run exists in the database — the
 * caller polls fetchRunStatus for progress.
 */
export async function startReport(
  companyName: string,
  reportYear: string,
  files: UploadEntry[],
): Promise<{ companyId: number; runId: number }> {
  const form = new FormData();
  form.append("companyName", companyName);
  form.append("reportYear", reportYear);
  for (const { file, sourceType } of files) {
    form.append("files", file);
    form.append("sourceTypes", sourceType);
  }

  const res = await fetch(`${API_URL}/api/generate-report`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Upload failed.");
  return res.json();
}

export async function fetchRunStatus(companyId: number, runId: number): Promise<RunStatus> {
  const res = await fetch(`${API_URL}/api/companies/${companyId}/runs/${runId}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not read run status.");
  return res.json();
}
