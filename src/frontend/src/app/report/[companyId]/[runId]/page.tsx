"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AssessmentReport } from "@/components/AssessmentReport";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { fetchRunStatus } from "@/lib/api";
import { getReports, setReports, type ReportPair } from "@/lib/report-store";

/**
 * Tries the fast path first — the in-tab store, set by the processing page
 * right after the run completed — and falls back to a real fetch from the
 * server otherwise (a reload, or opening this exact link fresh). The backend
 * persists both reports in SQLite, so unlike the earlier fully-ephemeral
 * design, this link keeps working after a reload; there just isn't a company
 * or report *listing* UI yet, so you need the link itself.
 */
export default function ReportPage() {
  const { companyId, runId } = useParams<{ companyId: string; runId: string }>();
  const [reports, setLocalReports] = useState<ReportPair | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = getReports();
    if (cached) {
      setLocalReports(cached);
      setState("ready");
      return;
    }

    let cancelled = false;
    fetchRunStatus(Number(companyId), Number(runId))
      .then((status) => {
        if (cancelled) return;
        if (status.aasbS2Report && status.esgReport) {
          const pair = { aasbS2Report: status.aasbS2Report, esgReport: status.esgReport };
          setReports(pair);
          setLocalReports(pair);
          setState("ready");
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
    };
  }, [companyId, runId]);

  return (
    <div className="surface-dark journey">
      <SiteHeader>
        <Link href="/report/preview" className="btn btn-ghost">
          Example report
        </Link>
        <Link href="/upload" className="btn btn-ghost">
          New report
        </Link>
      </SiteHeader>

      <main className="page page-wide" style={{ paddingTop: 24 }}>
        {state === "loading" && <p className="note">Loading…</p>}

        {state === "empty" && (
          <div style={{ paddingTop: 48, maxWidth: "54ch" }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, margin: "0 0 12px" }}>
              This run isn&rsquo;t finished yet
            </h1>
            <p className="note" style={{ fontSize: 15, marginBottom: 24 }}>
              Go back to the processing page for this run, or start a new one.
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
            <p className="note" style={{ fontSize: 15, marginBottom: 24 }}>{error}</p>
            <Link href="/upload" className="btn btn-primary">
              Generate a report
            </Link>
          </div>
        )}

        {state === "ready" && reports && (
          <AssessmentReport aasbS2Report={reports.aasbS2Report} esgReport={reports.esgReport} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
