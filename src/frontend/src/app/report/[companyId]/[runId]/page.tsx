"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AssessmentReport } from "@/components/AssessmentReport";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { fetchRunStatus } from "@/lib/api";
import { DEMO_COMPANY_ID, DEMO_RUN_ID } from "@/lib/demo";
import { type ReportPair } from "@/lib/report-store";

// Every report URL loads its own validated response from Express.
export default function ReportPage() {
  const { companyId, runId } = useParams<{ companyId: string; runId: string }>();
  const isDemo = Number(companyId) === DEMO_COMPANY_ID && Number(runId) === DEMO_RUN_ID;
  const [reports, setLocalReports] = useState<ReportPair | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setState("loading");
    setLocalReports(null);
    setError("");
    let cancelled = false;
    const controller = new AbortController();
    fetchRunStatus(Number(companyId), Number(runId), controller.signal)
      .then((status) => {
        if (cancelled) return;
        if (status.aasbS2Report) {
          const pair = { aasbS2Report: status.aasbS2Report };

          setLocalReports(pair);
          setState("ready");
        } else if (status.stage === "failed") {
          setError("Report processing failed. Saved evidence is retained.");
          setState("error");
        } else {
          setState("empty");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load this report.");
        setState("error");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [companyId, runId]);

  return (
    <div className="surface-dark journey">
      <SiteHeader>
        <Link href="/upload" className="btn btn-primary">
          Generate a report
        </Link>
      </SiteHeader>

      <main className="page page-wide" style={{ paddingTop: 24 }}>
        {isDemo && <span className="example-tag">Example report</span>}

        {state === "loading" && (
          <p className="note" role="status">
            Loading report…
          </p>
        )}

        {state === "empty" && (
          <div style={{ paddingTop: 48, maxWidth: "54ch" }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, margin: "0 0 12px" }}>
              Reports are not available for this run
            </h1>
            <p className="note" style={{ fontSize: 15, marginBottom: 24 }}>
              The run may still be processing, or one of its reports is missing. Check its processing status before starting again.
            </p>
            <Link href="/upload" className="btn btn-primary">
              Generate a report
            </Link>
          </div>
        )}

        {state === "error" && (
          <div style={{ paddingTop: 48, maxWidth: "54ch" }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, margin: "0 0 12px" }}>
              Couldn&rsquo;t load this report
            </h1>
            <p className="note" role="alert" style={{ fontSize: 15, marginBottom: 24 }}>{error}</p>
            <button className="btn" onClick={() => window.location.reload()}>Retry</button>
            <Link href="/upload" className="btn btn-primary">
              Generate a report
            </Link>
          </div>
        )}

        {state === "ready" && reports && (
          <AssessmentReport companyId={Number(companyId)} runId={Number(runId)} report={reports.aasbS2Report} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
