import type { Report } from "@climate/contract";

/**
 * The generated report lives here — in the browser tab's memory, and nowhere
 * else. Module state survives client-side navigation (processing -> report)
 * but is gone on reload or on closing the tab, which is exactly the intended
 * lifetime: generate it, read it, download it, and it is not kept.
 *
 * Deliberately not localStorage or sessionStorage. Those would outlive the
 * visit and turn a report about a company's climate position into something
 * left behind on a shared machine.
 */
let current: Report | null = null;

export function setReport(report: Report): void {
  current = report;
}

export function getReport(): Report | null {
  return current;
}

export function clearReport(): void {
  current = null;
}
