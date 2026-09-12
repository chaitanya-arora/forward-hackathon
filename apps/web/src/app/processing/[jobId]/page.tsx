"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { JobStage } from "@climate/contract";
import { TopBar } from "@/components/TopBar";
import { fetchStatus } from "@/lib/api";

/** The stages the user sees, in order. `queued` and `error` are handled separately. */
const VISIBLE_STAGES: Array<{ stage: JobStage; label: string }> = [
  { stage: "reading documents", label: "Reading documents" },
  { stage: "extracting", label: "Extracting evidence" },
  { stage: "analyzing pillars", label: "Assessing the four pillars" },
  { stage: "generating report", label: "Writing the report" },
];

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [stage, setStage] = useState<JobStage>("queued");
  const [detail, setDetail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    // Poll every 2s; the backend reports its real current stage, so this
    // progress text is never faked.
    const tick = async () => {
      try {
        const status = await fetchStatus(jobId);
        if (cancelled) return;
        setStage(status.stage);
        setDetail(status.detail ?? "");
        if (status.stage === "error") setError(status.error ?? "The analysis failed.");
        else if (status.done) router.push("/report");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Lost contact with the server.");
      }
    };

    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, router]);

  const activeIndex = VISIBLE_STAGES.findIndex((s) => s.stage === stage);

  return (
    <>
      <TopBar />
      <main className="page" style={{ paddingTop: 72, maxWidth: 620 }}>
        <p className="report-kicker">{error ? "Analysis failed" : "Analysing"}</p>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 600, margin: "0 0 32px" }}>
          {error ? "Something went wrong" : "Building the report"}
        </h1>

        {error ? (
          <>
            <p style={{ color: "var(--missing)", fontSize: 15, lineHeight: 1.6 }}>{error}</p>
            <a href="/upload" className="btn" style={{ marginTop: 20 }}>
              Try again
            </a>
          </>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {VISIBLE_STAGES.map((s, i) => {
              const state = activeIndex < 0 ? "pending" : i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
              return (
                <div
                  key={s.stage}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "22px minmax(0,1fr)",
                    gap: 14,
                    alignItems: "baseline",
                    padding: "14px 0",
                    borderBottom: "1px solid var(--rule)",
                    opacity: state === "pending" ? 0.4 : 1,
                    transition: "opacity .3s",
                  }}
                >
                  <span
                    style={{
                      color: state === "done" ? "var(--strong)" : "var(--accent)",
                      fontSize: 14,
                    }}
                  >
                    {state === "done" ? "✓" : state === "active" ? "●" : "○"}
                  </span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: state === "active" ? 600 : 400 }}>
                      {s.label}
                    </div>
                    {state === "active" && detail && (
                      <div className="note" style={{ marginTop: 3 }}>
                        {detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!error && (
          <p className="note" style={{ marginTop: 28 }}>
            One model call runs per section of each document, so longer documents take longer. You
            can leave this page open — the report is saved when it finishes.
          </p>
        )}
      </main>
    </>
  );
}
