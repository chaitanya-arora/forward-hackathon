import type { AasbS2Report } from "@/lib/assessment-types";

export interface ReportPair {
  aasbS2Report: AasbS2Report;
}

/**
 * The generated AASB report lives here — in the browser tab's memory, and
 * nowhere else on the client. Module state survives client-side navigation
 * (processing -> report) but is gone on reload or on closing the tab.
 *
 * The backend persists the canonical AASB report in SQLite. This module only controls what the *frontend*
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
