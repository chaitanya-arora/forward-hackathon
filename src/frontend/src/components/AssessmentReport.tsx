"use client";

import { useState } from "react";
import { InfoIcon } from "@/components/icons";
import type { AasbS2Report } from "@/lib/assessment-types";
import { AASB_SECTION_KEYS, AASB_SECTION_LABELS } from "@/lib/assessment-types";
import { AASB_AUDIENCE, AASB_INTRO } from "@/lib/report-copy";
import { readinessTone } from "@/lib/readiness";
import { downloadReportPdf } from "@/lib/api";

export function AssessmentReport({ companyId, runId, report }: { companyId: number; runId: number; report: AasbS2Report }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function exportPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const result = await downloadReportPdf(companyId, runId);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "PDF could not be generated.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="report-page">
      <div className="report-hero rise">
        <p className="eyebrow">AASB S2 Climate Readiness</p>
        <h1 className="display display-l" style={{ marginTop: 8 }}>{report.company}</h1>
        <p className="lede" style={{ marginTop: 10, fontSize: 15.5 }}>
          AASB S2 climate disclosure draft, reporting year {report.reportingPeriod.year ?? "unconfirmed"}
        </p>
      </div>

      <div className="report-controls">
        <button className="btn btn-primary" onClick={exportPdf} disabled={downloading}>
          {downloading ? "Preparing PDF…" : "Download AASB S2 PDF"}
        </button>
      </div>
      {downloadError && <p className="alert" role="alert">{downloadError}</p>}

      <ReportSummary report={report} />
      <DetailedAssessment report={report} />
    </div>
  );
}

const assessmentLabels: Record<string, string> = {
  complete: "Supported", present: "Supported", partial: "Partial evidence",
  missing: "Evidence missing", not_applicable: "Not applicable",
  requires_human_judgement: "Human review required",
  evidence_found_requires_judgement: "Human review required",
  requires_human_confirmation: "Human confirmation required",
};
function readableDetail(value: string) {
  return value.split(/\s+Extracted:/i)[0].replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
function DetailedAssessment({ report }: { report: AasbS2Report }) {
  return <section className="report-summary-section" aria-label="Detailed AASB assessment">
    <h2>Detailed AASB assessment</h2>
    <p className="note">Open a section to review its requirements, evidence and follow-ups. Supporting values remain in the full stored report and the PDF.</p>
    {AASB_SECTION_KEYS.map(key => <details key={key} style={{ marginTop: 20 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{AASB_SECTION_LABELS[key]}</summary>
      <ul className="summary-list">
        {(Array.isArray(report[key]?.criteria) ? report[key].criteria : []).map(criterion => <li key={criterion.id}>
          <strong>{criterion.description}</strong>
          <p className="note">{assessmentLabels[criterion.completenessStatus ?? criterion.status] ?? "Review required"}</p>
          <p>{typeof criterion.finding === "string" ? readableDetail(criterion.finding) : "Review the supporting evidence."}</p>
          {Array.isArray(criterion.requiredInformation) && criterion.requiredInformation.length > 0 && <p>Follow-up: {criterion.requiredInformation.filter(v => typeof v === "string").map(readableDetail).join(" ")}</p>}
          {criterion.reference && <p className="note">Standard reference: {criterion.reference}</p>}
          {Array.isArray(criterion.citations) && criterion.citations.length > 0 && <details>
            <summary>Supporting quotations ({criterion.citations.length})</summary>
            {criterion.citations.map((citation, index) => <blockquote key={index}>
              <p>{citation.quote}</p>
              <cite className="note">{citation.source ?? citation.evidenceId}{citation.pages?.length ? `, page ${citation.pages.join(", ")}` : ""}</cite>
            </blockquote>)}
          </details>}
        </li>)}
      </ul>
    </details>)}
  </section>;
}

function ReportSummary({ report }: { report: AasbS2Report }) {
  const { executiveSummary: summary, keyFindings, priorityActions } = report.presentation;
  const [showAllActions, setShowAllActions] = useState(false);
  const actions = showAllActions ? priorityActions : priorityActions.slice(0, 5);

  return (
    <section id="report-summary" className="report-summary-section">
      <div className="section-head">
        <h2>AASB S2 Climate Readiness</h2>
      </div>

      <div className="callout">
        <span className="callout-icon">
          <InfoIcon />
        </span>
        <div>
          <p className="callout-label">About this assessment</p>
          <p>
            A draft for management, director and assurance review. It assesses disclosure evidence and preparation needs; it does not certify compliance or approval for lodgement.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <span className="callout-icon">
          <InfoIcon />
        </span>
        <div>
          <p className="callout-label">Who this report is for</p>
          <p>{AASB_AUDIENCE}</p>
        </div>
      </div>

      <p className="lede" style={{ marginTop: 24, fontSize: 15.5 }}>
        {AASB_INTRO}
      </p>

      <h3 className="subhead">Executive summary</h3>
      <div className="readiness-overview">
        <div
          className={"readiness-score readiness-" + readinessTone(summary.readinessScore)}
          aria-label={(summary.readinessScore == null ? "Unavailable" : summary.readinessScore + " out of 100") + " Readiness"}
        >
          <strong>
            {summary.readinessScore == null ? "—" : summary.readinessScore}
            <small>{summary.readinessScore == null ? "" : "/100"}</small>
          </strong>
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
          {keyFindings.map((f) => (
            <li key={f.id}>
              <strong>{f.title}</strong>
              <p>{f.summary}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">No key findings identified from the supplied documents.</p>
      )}

      <h3 className="subhead">Priority actions</h3>
      {priorityActions.length ? (
        <>
          <ol className="summary-list" aria-label="Priority actions">
            {actions.map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                <p>{a.description}</p>
              </li>
            ))}
          </ol>
          {priorityActions.length > 5 && (
            <button
              className="btn"
              style={{ marginTop: 20 }}
              aria-expanded={showAllActions}
              onClick={() => setShowAllActions(!showAllActions)}
            >
              {showAllActions ? "Show top 5 actions" : "Show all " + priorityActions.length + " actions"}
            </button>
          )}
        </>
      ) : (
        <p className="note">No priority evidence actions identified from the supplied documents.</p>
      )}
    </section>
  );
}
