import type { AasbS2Report, EsgReport } from "@/lib/assessment-types";

export interface ReportPair {
  aasbS2Report: AasbS2Report;
  esgReport: EsgReport;
}

/**
 * The two generated reports live here — in the browser tab's memory, and
 * nowhere else on the client. Module state survives client-side navigation
 * (processing -> report) but is gone on reload or on closing the tab.
 *
 * The backend does persist everything in SQLite (companies, documents, both
 * reports, retrievable by ID) — that decision was made explicitly to use the
 * real pipeline as-is for now. This module only controls what the *frontend*
 * caches client-side; it deliberately never uses localStorage/sessionStorage,
 * so nothing about the run is left behind in the browser itself.
 */
let current: ReportPair | null = null;

export function setReports(reports: ReportPair): void {
  current = reports;
}

export function getReports(): ReportPair | null {
  return current;
}

export function clearReports(): void {
  current = null;
}
