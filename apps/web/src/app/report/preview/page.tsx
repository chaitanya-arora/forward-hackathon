import Link from "next/link";
import { ReportSchema } from "@climate/contract";
import { ReportView } from "@/components/ReportView";
import { TopBar } from "@/components/TopBar";
import mock from "../../../../mock/report.json";

/**
 * Renders the locked mock report (spec §2 / plan step 1). This is what the
 * report view is designed against while the agents are being built, and it
 * needs no API key or backend to open.
 */
export default function ReportPreviewPage() {
  const report = ReportSchema.parse(mock);

  return (
    <>
      <TopBar>
        <Link href="/report" className="btn">
          Live report
        </Link>
      </TopBar>
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
          Preview — rendered from <code>mock/report.json</code>, not from a real run.
        </p>
        <ReportView report={report} />
      </main>
    </>
  );
}
