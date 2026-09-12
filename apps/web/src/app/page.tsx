import Link from "next/link";
import { TopBar } from "@/components/TopBar";

export default function LandingPage() {
  return (
    <>
      <TopBar>
        <Link href="/report" className="btn">
          Latest report
        </Link>
      </TopBar>

      <main className="page" style={{ paddingTop: 64 }}>
        <p className="report-kicker">Climate disclosure readiness</p>
        <h1
          className="report-company"
          style={{ fontFamily: "var(--serif)", maxWidth: "16ch", marginBottom: 24 }}
        >
          Your documents in. A cited report out.
        </h1>

        <p style={{ fontSize: 19, lineHeight: 1.65, maxWidth: "58ch", color: "var(--ink-muted)" }}>
          Most companies without a dedicated sustainability team already hold the evidence an AASB S2
          or TCFD assessment needs — it is just scattered across annual reports, board policies and
          internal memos. Upload whatever you have. Every claim in the report that comes back is
          traced to the document and page it came from.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
          <Link href="/upload" className="btn btn-primary">
            Generate a report
          </Link>
          <Link href="/report" className="btn">
            View the latest report
          </Link>
        </div>

        <div
          style={{
            marginTop: 72,
            paddingTop: 28,
            borderTop: "1px solid var(--rule)",
            display: "grid",
            gap: 28,
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          }}
        >
          {[
            {
              h: "Four pillars",
              p: "Governance, Strategy, Risk Management, and Metrics & Targets, each assessed against the disclosure criteria the standards actually specify.",
            },
            {
              h: "Evidence pooled, not compared",
              p: "Every document you provide strengthens the same assessment. More material means a more complete report, never a contradiction to resolve.",
            },
            {
              h: "Nothing unsourced",
              p: "Each pillar cites the specific claims behind it, with document name and page number, so a reader can check the work.",
            },
          ].map((col) => (
            <div key={col.h}>
              <h2
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 18,
                  fontWeight: 600,
                  margin: "0 0 8px",
                }}
              >
                {col.h}
              </h2>
              <p className="note">{col.p}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
