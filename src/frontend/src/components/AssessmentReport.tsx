"use client";

import { useState } from "react";
import { InfoIcon } from "@/components/icons";
import type { AasbS2Report, EsgReport } from "@/lib/assessment-types";
import { AASB_AUDIENCE, AASB_INTRO, ESG_AUDIENCE, ESG_INTRO } from "@/lib/report-copy";

type View = "aasb" | "esg";

/**
 * The full evidence-level report (every criterion, every citation) isn't
 * built here — it's a separate, formally-formatted PDF the backend will
 * produce and link to (report.fullReportUrl). This component is the
 * on-screen summary, styled as part of the site rather than a paper
 * document: which framework, who it's for, and three sections the backend
 * will populate (business engagement summary, key findings, priority
 * actions) — placeholders until that JSON lands.
 */
export function AssessmentReport({
  aasbS2Report,
  esgReport,
}: {
  aasbS2Report: AasbS2Report;
  esgReport: EsgReport;
}) {
  const [view, setView] = useState<View>("aasb");

  const company = aasbS2Report.company || esgReport.company;
  const fullReportUrl = view === "aasb" ? aasbS2Report.fullReportUrl : esgReport.fullReportUrl;

  return (
    <div className="report-page">
      <div className="report-hero rise" style={{ ["--i" as string]: 0 }}>
        <p className="eyebrow">Climate &amp; ESG Readiness Assessment</p>
        <h1 className="display display-l" style={{ marginTop: 8 }}>
          {company}
        </h1>
        <p className="lede" style={{ marginTop: 10, fontSize: 15.5 }}>
          {view === "aasb"
            ? `AASB S2 climate disclosure draft, reporting year ${aasbS2Report.reportingPeriod.year}`
            : "ESG evidence-readiness assessment"}
        </p>
      </div>

      <div className="report-controls rise" style={{ ["--i" as string]: 1 }}>
        <div className="view-toggle" role="tablist" aria-label="Report type">
          <button
            role="tab"
            aria-selected={view === "aasb"}
            className={view === "aasb" ? "is-active" : ""}
            onClick={() => setView("aasb")}
          >
            AASB S2
          </button>
          <button
            role="tab"
            aria-selected={view === "esg"}
            className={view === "esg" ? "is-active" : ""}
            onClick={() => setView("esg")}
          >
            ESG
          </button>
        </div>

        {fullReportUrl ? (
          <a className="btn btn-primary" href={fullReportUrl}>
            Download full report (PDF)
          </a>
        ) : (
          <button className="btn btn-primary" disabled title="The full report isn't ready yet">
            Download full report (PDF)
          </button>
        )}
      </div>

      {view === "aasb" ? (
        <ReportSummary
          heading="AASB S2 Climate Readiness"
          audience={AASB_AUDIENCE}
          intro={AASB_INTRO}
          businessEngagementSummary={aasbS2Report.businessEngagementSummary}
          keyFindings={aasbS2Report.keyFindingsSummary}
          priorityActions={aasbS2Report.priorityActionsSummary}
        />
      ) : (
        <ReportSummary
          heading="ESG Evidence Readiness"
          audience={ESG_AUDIENCE}
          intro={ESG_INTRO}
          businessEngagementSummary={esgReport.businessEngagementSummary}
          keyFindings={esgReport.keyFindingsSummary}
          priorityActions={esgReport.priorityActionsSummary}
        />
      )}
    </div>
  );
}

function ReportSummary({
  heading,
  audience,
  intro,
  businessEngagementSummary,
  keyFindings,
  priorityActions,
}: {
  heading: string;
  audience: string;
  intro: string;
  businessEngagementSummary?: string;
  keyFindings?: string[];
  priorityActions?: string[];
}) {
  return (
    <section className="report-summary-section rise" style={{ ["--i" as string]: 2 }}>
      <div className="section-head">
        <h2>{heading}</h2>
      </div>

      <div className="callout">
        <span className="callout-icon">
          <InfoIcon />
        </span>
        <div>
          <p className="callout-label">Who this report is for</p>
          <p>{audience}</p>
        </div>
      </div>

      <p className="lede" style={{ marginTop: 24, fontSize: 15.5 }}>
        {intro}
      </p>

      <h3 className="subhead">Executive summary</h3>
      {businessEngagementSummary ? (
        <p className="summary-text">{businessEngagementSummary}</p>
      ) : (
        <PlaceholderPanel text="A summary of how this business engages with the framework, generated from its uploaded documentation, will appear here." />
      )}

      <h3 className="subhead">Key findings</h3>
      {keyFindings && keyFindings.length > 0 ? (
        <ul className="summary-list">
          {keyFindings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : (
        <PlaceholderPanel text="Key findings from the rubric assessment will appear here." />
      )}

      <h3 className="subhead">Priority actions</h3>
      {priorityActions && priorityActions.length > 0 ? (
        <ol className="summary-list">
          {priorityActions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      ) : (
        <PlaceholderPanel text="Prioritised action points will appear here." />
      )}
    </section>
  );
}

function PlaceholderPanel({ text }: { text: string }) {
  return (
    <div className="placeholder-panel">
      <p>{text}</p>
      <span className="placeholder-tag">Coming soon</span>
    </div>
  );
}
