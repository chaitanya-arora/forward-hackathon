"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RunStage, RunStatus } from "@/lib/assessment-types";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WhileYouWait } from "@/components/WhileYouWait";
import { fetchRunStatus } from "@/lib/api";
import { setReports } from "@/lib/report-store";

/** The real stages the pipeline reports, in order. `failed` is handled separately. */
const VISIBLE_STAGES: Array<{ stage: RunStage; label: string }> = [
  { stage: "extracting", label: "Reading documents" },
  { stage: "aasb_analysing", label: "Drafting the AASB S2 report" },
  { stage: "esg_analysing", label: "Assessing ESG evidence" },
  { stage: "completed", label: "Done" },
];

export default function ProcessingPage() {
  const { companyId, runId } = useParams<{ companyId: string; runId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !runId) return;
    let cancelled = false;

    // Poll every 3s. Gemini calls are rate-limited to roughly one per 15s
    // project-wide, so a real run with several documents can take a few
    // minutes — the stage label is always the pipeline's actual stage, never
    // a faked timer.
    const tick = async () => {
      try {
        const next = await fetchRunStatus(Number(companyId), Number(runId));
        if (cancelled) return;
        setStatus(next);
        if (next.stage === "failed") {
          setError(next.error?.message ?? "The analysis failed.");
        } else if (next.done && next.aasbS2Report && next.esgReport) {
          setReports({ aasbS2Report: next.aasbS2Report, esgReport: next.esgReport });
          router.push(`/report/${companyId}/${runId}`);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Lost contact with the server.");
      }
    };

    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [companyId, runId, router]);

  const stage = status?.stage ?? "extracting";
  const activeIndex = VISIBLE_STAGES.findIndex((s) => s.stage === stage);

  return (
    <div className="surface-dark journey">
      <SiteHeader />

      <main className="page" style={{ paddingTop: 28 }}>
        <p className="eyebrow rise">{error ? (status?.error?.code === "AI_QUOTA_EXHAUSTED" ? "Temporarily unavailable" : "Analysis failed") : "Step two of two"}</p>
        <h1 className="display display-l rise" style={{ ["--i" as string]: 1 }}>
          {error ? (status?.error?.code === "AI_QUOTA_EXHAUSTED" ? "AI processing is temporarily unavailable" : "Something went wrong") : "Building both reports"}
        </h1>

        {error ? (
          <>
            <div className="alert" style={{ marginTop: 22, maxWidth: "60ch" }}>
              {status?.error?.code === "AI_QUOTA_EXHAUSTED"
                ? "The AI service has reached its current usage limit. Your upload was received, but report generation could not complete. Please try again later."
                : error}
            </div>
            <Link href="/upload" className="btn" style={{ marginTop: 20 }}>
              Try again
            </Link>
          </>
        ) : (
          <>
            <div className="stages rise" style={{ ["--i" as string]: 3, marginTop: 24 }}>
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
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="note" style={{ marginTop: 22, maxWidth: "60ch" }}>
              AASB S2 is drafted first, then the ESG assessment, both from the same extracted
              evidence. Gemini requests are rate-limited, so a document with many pages can take a
              few minutes — you can leave this page open, nothing is lost if you close it and come
              back to the report link.
            </p>

            <WhileYouWait />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
