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
 *
 * The page chrome matches every other page (dark journey surface); the
 * report itself is a paper sheet sitting on it, because the actual
 * deliverable is a downloaded PDF and this is meant to look like one.
 */
export default function ReportPreviewPage() {
  const aasbS2Report = run.aasbS2Report as unknown as AasbS2Report;
  const esgReport = run.esgReport as unknown as EsgReport;

  return (
    <div className="surface-dark journey">
      <SiteHeader>
        <Link href="/upload" className="btn btn-primary">
          Generate a report
        </Link>
      </SiteHeader>
      <main className="page page-wide" style={{ paddingTop: 32 }}>
        <AssessmentReport aasbS2Report={aasbS2Report} esgReport={esgReport} />
      </main>

      <SiteFooter />
    </div>
  );
}
