"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { JobStage, JobStatus } from "@climate/contract";
import { TopBar } from "@/components/TopBar";
import { WhileYouWait } from "@/components/WhileYouWait";
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
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    // Poll every 2s. Every number shown below comes from the running pipeline,
    // so this screen never reports progress that hasn't happened.
    const tick = async () => {
      try {
        const next = await fetchStatus(jobId);
        if (cancelled) return;
        setStatus(next);
        if (next.stage === "error") setError(next.error ?? "The analysis failed.");
        else if (next.done) router.push("/report");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Lost contact with the server.");
        }
      }
    };

    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, router]);

  const stage = status?.stage ?? "queued";
  const activeIndex = VISIBLE_STAGES.findIndex((s) => s.stage === stage);
  const progress = status?.progress;

  return (
    <div className="surface-dark journey">
      <TopBar />

      <main className="page" style={{ paddingTop: 28 }}>
        <p className="eyebrow rise">{error ? "Analysis failed" : "Step two of two"}</p>
        <h1 className="display display-l rise" style={{ ["--i" as string]: 1 }}>
          {error ? "Something went wrong" : "Building the report"}
        </h1>

        {error ? (
          <>
            <div className="alert" style={{ marginTop: 22, maxWidth: "60ch" }}>
              {error}
            </div>
            <Link href="/upload" className="btn" style={{ marginTop: 20 }}>
              Try again
            </Link>
          </>
        ) : (
          <>
            {/* The live tally. Counts real evidence kept, as each section returns. */}
            <div className="tally rise" style={{ ["--i" as string]: 2, marginTop: 24 }}>
              {/* Rendered raw, not eased: this number must always equal what the
                  pipeline has actually found. The climbing itself is the motion. */}
              <b>{progress?.evidence_found ?? 0}</b>
              <span>
                {progress
                  ? `pieces of evidence found across ${progress.chunks_done} of ${progress.chunks_total} sections`
                  : "reading your documents…"}
              </span>
            </div>

            <div className="stages rise" style={{ ["--i" as string]: 3 }}>
              {VISIBLE_STAGES.map((s, i) => {
                const state =
                  activeIndex < 0
                    ? "pending"
                    : i < activeIndex
                      ? "done"
                      : i === activeIndex
                        ? "active"
                        : "pending";
                return (
                  <div className={`stage stage-${state}`} key={s.stage}>
                    <span className="stage-mark">
                      {state === "done" ? "✓" : state === "active" ? "●" : "○"}
                    </span>
                    <div>
                      <div className="stage-label">{s.label}</div>
                      {state === "active" && status?.detail && (
                        <div className="stage-detail">{status.detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="note" style={{ marginTop: 22 }}>
              One model call runs per section of each document, so longer documents take longer. You
              can leave this page open — the report is saved when it finishes.
            </p>

            <WhileYouWait />
          </>
        )}
      </main>
    </div>
  );
}
