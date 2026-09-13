import { runSchema } from "./presentation";
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

export async function fetchRunStatus(companyId: number, runId: number, signal?: AbortSignal): Promise<RunStatus> {
  if (![companyId, runId].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error("Run not found. Check the report link.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/companies/${companyId}/runs/${runId}`, { cache: "no-store", signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Cannot reach the report API. Check that the backend is running and try again.");
  }
  if (!res.ok) throw new Error(res.status === 404 ? "Run not found. Check the company and run in this link." : "The API could not load the saved reports. Check the server and report exports.");
  const parsed = runSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new Error("The API returned an invalid report format. A valid presentation section is required for each report.");
  if (parsed.data.companyId !== companyId || parsed.data.runId !== runId) throw new Error("The API returned a different run. Please reload the correct report link.");
  return parsed.data as unknown as RunStatus;
}
