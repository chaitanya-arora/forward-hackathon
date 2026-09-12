import Link from "next/link";
import { AssessmentReport } from "@/components/AssessmentReport";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { AasbS2Report, EsgReport } from "@/lib/assessment-types";
import run from "../../../../mock/run.json";

/**
 * Renders a real saved run — src/frontend/mock/run.json is genuine output
 * from the actual pipeline (main's Agent 1 + AASB + ESG generators), not a
 * hand-authored fixture. This needs no API key or backend to open.
 */
export default function ReportPreviewPage() {
  const aasbS2Report = run.aasbS2Report as unknown as AasbS2Report;
  const esgReport = run.esgReport as unknown as EsgReport;

  return (
    <>
      <SiteHeader>
        <Link href="/upload" className="btn btn-primary">
          Generate a report
        </Link>
      </SiteHeader>
      <main className="page" style={{ paddingTop: 32 }}>
        <p
          className="no-print note"
          style={{
            marginBottom: 24,
            padding: "8px 12px",
            background: "var(--surface-sunk)",
            borderRadius: 5,
            display: "inline-block",
          }}
        >
          Preview — a real saved run, not a live one.
        </p>
        <AssessmentReport aasbS2Report={aasbS2Report} esgReport={esgReport} />
      </main>

      <SiteFooter />
    </>
  );
}
