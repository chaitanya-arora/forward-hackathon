import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * There is no "latest report" anymore — every run has its own URL at
 * /report/[companyId]/[runId], returned once a run starts. This bare route
 * only exists for someone landing here directly with no run to show.
 */
export default function ReportIndexPage() {
  return (
    <div className="surface-dark journey">
      <SiteHeader />
      <main className="page" style={{ paddingTop: 48 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, margin: "0 0 12px" }}>
          No report open
        </h1>
        <p className="note" style={{ fontSize: 15, marginBottom: 24, maxWidth: "54ch" }}>
          Every generated report has its own link, given to you right after you start one. Generate a
          new report, or look at a real saved example.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/upload" className="btn btn-primary">
            Generate a report
          </Link>
          <Link href="/report/preview" className="btn">
            See an example report
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
