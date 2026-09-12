"use client";

import { useState } from "react";
import type { AasbS2Report, EsgReport } from "@/lib/assessment-types";

type View = "aasb" | "esg";

const AASB_AUDIENCE =
  "This is a government-facing report: AASB S2 is a mandatory legislated disclosure standard, so it's written the way a regulator, auditor, or lodgement reviewer would read it.";

const AASB_INTRO =
  "AASB S2 is Australia's mandatory climate-related disclosure standard — legislated, effective for reporting periods from 2025, and based on the international ISSB framework. It requires companies to report across four pillars: Governance, Strategy, Risk Management, and Metrics & Targets. Our Climate Readiness Report scores a company against exactly these four pillars, using its own uploaded documentation as evidence, showing where disclosure is strong and where it falls short of what the standard actually requires.";

const ESG_AUDIENCE =
  "This is a stakeholder-facing report: it's written for investors, customers, and partners deciding whether to trust an ESG claim, not for a regulator.";

const ESG_INTRO =
  "Before a company can credibly claim anything about its ESG performance, it needs to be able to back that claim with real, traceable evidence — not just a statement of intent. This report is the evidence layer underneath the readiness score: it shows exactly what supporting material exists for each ESG claim, how strong that evidence actually is, and where claims currently rest on nothing verifiable.";

/**
 * The full evidence-level report (every criterion, every citation) is no
 * longer built here — it's a separate, formally-formatted PDF the backend
 * will produce and link to (report.fullReportUrl). This component's job is
 * just the on-screen summary: which framework, who it's for, and three
 * sections the backend will populate (business engagement summary, key
 * findings, priority actions) — placeholders until that JSON lands.
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
    <>
      <div className="report-controls no-print">
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

      <div className="paper-sheet">
        <article className="report">
          <header className="report-masthead">
            <p className="report-kicker">Climate &amp; ESG Readiness Assessment</p>
            <h1 className="report-company">{company}</h1>
            <p className="report-dateline">
              {view === "aasb"
                ? `AASB S2 climate disclosure draft, reporting year ${aasbS2Report.reportingPeriod.year}`
                : "ESG evidence-readiness assessment"}
            </p>
          </header>

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
        </article>
      </div>
    </>
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
    <section className="report-block">
      <div className="report-type-heading">
        <h2>{heading}</h2>
      </div>
      <p className="report-audience">
        <span className="report-explainer-label">Who this report is for</span>
        {audience}
      </p>
      <p className="report-type-sub">{intro}</p>

      <h3 className="summary-heading">Executive summary</h3>
      {businessEngagementSummary ? (
        <p className="report-executive-summary">{businessEngagementSummary}</p>
      ) : (
        <PlaceholderBlock text="A summary of how this business engages with the framework, generated from its uploaded documentation, will appear here." />
      )}

      <h3 className="summary-heading">Key findings</h3>
      {keyFindings && keyFindings.length > 0 ? (
        <ul className="summary-list">
          {keyFindings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : (
        <PlaceholderBlock text="Key findings from the rubric assessment will appear here." />
      )}

      <h3 className="summary-heading">Priority actions</h3>
      {priorityActions && priorityActions.length > 0 ? (
        <ol className="summary-list">
          {priorityActions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      ) : (
        <PlaceholderBlock text="Prioritised action points will appear here." />
      )}
    </section>
  );
}

function PlaceholderBlock({ text }: { text: string }) {
  return (
    <div className="placeholder-block">
      <p>{text}</p>
      <span className="placeholder-tag">Coming soon</span>
    </div>
  );
}
