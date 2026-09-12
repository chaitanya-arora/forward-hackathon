"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Report } from "@climate/contract";
import { ReportView } from "@/components/ReportView";
import { TopBar } from "@/components/TopBar";
import { getReport } from "@/lib/report-store";

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [ready, setReady] = useState(false);

  // Read on mount rather than during render: the report lives in module memory,
  // which the server has no view of, so the first paint must be client-side.
  useEffect(() => {
    setReport(getReport());
    setReady(true);
  }, []);

  return (
    <>
      <TopBar>
        <Link href="/report/preview" className="btn btn-ghost">
          Example report
        </Link>
        <Link href="/upload" className="btn btn-ghost">
          New report
        </Link>
        {report && (
          <button className="btn btn-primary" onClick={() => window.print()}>
            Download PDF
          </button>
        )}
      </TopBar>

      <main className="page" style={{ paddingTop: 24 }}>
        {!ready && <p className="note">Loading…</p>}

        {ready && !report && (
          <div style={{ paddingTop: 48, maxWidth: "54ch" }}>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: 30,
                fontWeight: 600,
                margin: "0 0 12px",
              }}
            >
              No report in this session
            </h1>
            <p className="note" style={{ fontSize: 15, marginBottom: 24 }}>
              GreenScreen does not keep reports. A report exists only in the tab that generated it,
              so reloading or reopening this page starts from nothing. Generate a new one, or look at
              the example to see what comes back.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/upload" className="btn btn-primary">
                Generate a report
              </Link>
              <Link href="/report/preview" className="btn">
                See an example report
              </Link>
            </div>
          </div>
        )}

        {ready && report && (
          <>
            {/* The one thing a reader must know before they navigate away. */}
            <div className="keepsafe no-print">
              <div>
                <b>This report is not saved.</b> It exists only in this browser tab — reloading or
                closing it will lose the report for good.
              </div>
              <button className="btn btn-primary" onClick={() => window.print()}>
                Download PDF
              </button>
            </div>
            <ReportView report={report} />
          </>
        )}
      </main>
    </>
  );
}
