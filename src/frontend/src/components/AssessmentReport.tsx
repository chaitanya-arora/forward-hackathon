"use client";
import { useState } from "react";
import { InfoIcon } from "@/components/icons";
import type { AasbS2Report, EsgReport } from "@/lib/assessment-types";
import type { Presentation } from "@/lib/presentation";
import { readinessTone } from "@/lib/readiness";

export function AssessmentReport({ aasbS2Report, esgReport }: { aasbS2Report: AasbS2Report; esgReport: EsgReport }) {
  const [view, setView] = useState<"aasb" | "esg">("aasb");
  const selected = view === "aasb" ? aasbS2Report : esgReport;
  return (
    <div className="report-page">
      <div className="report-hero rise">
        <p className="eyebrow">Climate &amp; ESG Readiness Assessment</p>
        <h1 className="display display-l" style={{ marginTop: 8 }}>{selected.company}</h1>
        <p className="lede" style={{ marginTop: 10, fontSize: 15.5 }}>
          {view === "aasb" ? "AASB S2 climate disclosure draft, reporting year " + (aasbS2Report.reportingPeriod.year ?? "unconfirmed") : "ESG evidence-readiness assessment"}
        </p>
      </div>
      <div className="report-controls">
        <div className="view-toggle" role="tablist" aria-label="Report type">
          {(["aasb", "esg"] as const).map(tab => (
            <button key={tab} id={"tab-" + tab} role="tab" aria-selected={view === tab}
              aria-controls="report-summary" className={view === tab ? "is-active" : ""}
              onClick={() => setView(tab)}>{tab === "aasb" ? "AASB S2" : "ESG"}</button>
          ))}
        </div>
        <button className="btn btn-primary" disabled>PDF export coming soon</button>
      </div>
      <ReportSummary key={view} view={view} presentation={selected.presentation} />
    </div>
  );
}

function ReportSummary({ view, presentation }: { view: "aasb" | "esg"; presentation: Presentation }) {
  const { executiveSummary: summary, keyFindings, priorityActions } = presentation;
  const [showAllActions, setShowAllActions] = useState(false);
  const actions = showAllActions ? priorityActions : priorityActions.slice(0, 5);
  return (
    <section id="report-summary" role="tabpanel" aria-labelledby={"tab-" + view} className="report-summary-section">
      <div className="section-head"><h2>{view === "aasb" ? "AASB S2 Climate Readiness" : "ESG Evidence Readiness"}</h2></div>
      <div className="callout">
        <span className="callout-icon"><InfoIcon /></span>
        <div>
          <p className="callout-label">About this assessment</p>
          <p>{view === "aasb"
            ? "A draft for management, director and assurance review. It assesses disclosure evidence and preparation needs; it does not certify compliance or approval for lodgement."
            : "An assessment of the evidence supporting environmental, social and governance disclosures. It does not rate company ESG performance."}</p>
        </div>
      </div>
      <h3 className="subhead">Executive summary</h3>
      <div className="readiness-overview">
        <div className={"readiness-score readiness-" + readinessTone(summary.readinessScore)}
          aria-label={(summary.readinessScore == null ? "Unavailable" : summary.readinessScore + " out of 100") + " Readiness"}>
          <strong>{summary.readinessScore == null ? "—" : summary.readinessScore}<small>{summary.readinessScore == null ? "" : "/100"}</small></strong>
          <span>{summary.readinessLabel}</span>
        </div>
        <div>
          <h4 className="summary-headline">{summary.headline}</h4>
          <p className="summary-text">{summary.summary}</p>
          <p className="note score-disclaimer">{summary.scoreDisclaimer}</p>
          {summary.requiresHumanReview && <p className="note">Human review required.</p>}
        </div>
      </div>
      <h3 className="subhead">Key findings</h3>
      {keyFindings.length ? (
        <ul className="summary-list" aria-label="Key findings">
          {keyFindings.map(f => <li key={f.id}><strong>{f.title}</strong><p>{f.summary}</p></li>)}
        </ul>
      ) : <p className="note">No key findings identified from the supplied documents.</p>}
      <h3 className="subhead">Priority actions</h3>
      {priorityActions.length ? (
        <>
          <ol className="summary-list" aria-label="Priority actions">
            {actions.map(a => <li key={a.id}><strong>{a.title}</strong><p>{a.description}</p></li>)}
          </ol>
          {priorityActions.length > 5 && (
            <button className="btn" style={{ marginTop: 20 }} aria-expanded={showAllActions}
              onClick={() => setShowAllActions(!showAllActions)}>
              {showAllActions ? "Show top 5 actions" : "Show all " + priorityActions.length + " actions"}
            </button>
          )}
        </>
      ) : <p className="note">No priority evidence actions identified from the supplied documents.</p>}
    </section>
  );
}
