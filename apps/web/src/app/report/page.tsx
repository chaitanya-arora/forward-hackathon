"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Report } from "@climate/contract";
import { ReportView } from "@/components/ReportView";
import { TopBar } from "@/components/TopBar";
import { fetchLatest } from "@/lib/api";

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchLatest()
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setState(r ? "ready" : "empty");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the report.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopBar>
        <Link href="/upload" className="btn">
          New report
        </Link>
        {state === "ready" && (
          <button className="btn btn-primary" onClick={() => window.print()}>
            Export PDF
          </button>
        )}
      </TopBar>

      <main className="page" style={{ paddingTop: 32 }}>
        {state === "loading" && <p className="note">Loading the latest report…</p>}

        {state === "empty" && (
          <div style={{ paddingTop: 40 }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600, margin: "0 0 10px" }}>
              No report yet
            </h1>
            <p className="note" style={{ marginBottom: 20 }}>
              Upload a company&rsquo;s climate documentation to generate one.
            </p>
            <Link href="/upload" className="btn btn-primary">
              Get started
            </Link>
          </div>
        )}

        {state === "error" && (
          <p className="note" style={{ color: "var(--missing)", paddingTop: 40 }}>
            {error}
          </p>
        )}

        {state === "ready" && report && <ReportView report={report} />}
      </main>
    </>
  );
}
