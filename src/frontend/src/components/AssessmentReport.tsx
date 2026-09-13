"use client";

import { useState } from "react";
<<<<<<< HEAD
import { InfoIcon } from "@/components/icons";
import type { AasbS2Report } from "@/lib/assessment-types";
import { AASB_SECTION_KEYS, AASB_SECTION_LABELS } from "@/lib/assessment-types";
import { AASB_AUDIENCE, AASB_INTRO } from "@/lib/report-copy";
import { readinessTone } from "@/lib/readiness";
import { downloadReportPdf } from "@/lib/api";

export function AssessmentReport({ companyId, runId, report }: { companyId: number; runId: number; report: AasbS2Report }) {
=======
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon } from "@/components/icons";
import { AASB_SECTION_LABELS, type AasbS2Report, type EsgReport } from "@/lib/assessment-types";
import type { Presentation } from "@/lib/presentation";
import { AASB_AUDIENCE, AASB_INTRO, ESG_AUDIENCE, ESG_INTRO } from "@/lib/report-copy";
import { readinessTone } from "@/lib/readiness";
import { downloadReportPdf } from "@/lib/api";

type Finding = Presentation["keyFindings"][number];
type PriorityAction = Presentation["priorityActions"][number];

const ESG_SECTION_LABELS: Record<string, string> = {
  environmental: "Environmental",
  social: "Social",
  governance: "Governance",
};

function sectionLabel(view: "aasb" | "esg", section: string): string {
  const labels = view === "aasb" ? AASB_SECTION_LABELS : ESG_SECTION_LABELS;
  return labels[section] ?? section;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  provide_evidence: "Evidence needed",
  human_confirmation: "Needs confirmation",
  professional_judgement: "Professional judgement",
  resolve_conflict: "Resolve conflict",
  external_assurance: "External assurance",
  director_action: "Director action",
};

export function AssessmentReport({ aasbS2Report, esgReport }: { aasbS2Report: AasbS2Report; esgReport: EsgReport }) {
export function AssessmentReport({ companyId, runId, aasbS2Report, esgReport }: { companyId: number; runId: number; aasbS2Report: AasbS2Report; esgReport: EsgReport }) {
  const [view, setView] = useState<"aasb" | "esg">("aasb");
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
>>>>>>> origin/main
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
        <div className="findings-grid" aria-label="Key findings">
          {keyFindings.map((f) => (
            <FindingCard key={f.id} finding={f} view={view} />
          ))}
        </div>
      ) : (
        <p className="note">No key findings identified from the supplied documents.</p>
      )}

      <h3 className="subhead">Priority actions</h3>
      {priorityActions.length ? (
        <>
          <div className="actions-grid" aria-label="Priority actions">
            {actions.map((a, i) => (
              <ActionCard key={a.id} action={a} view={view} rank={i + 1} />
            ))}
          </div>
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

function FindingCard({ finding, view }: { finding: Finding; view: "aasb" | "esg" }) {
  const evidenceCount = finding.evidenceIds.length;
  return (
    <div className={"finding-card finding-card--" + finding.importance}>
      <span className="finding-icon">
        {finding.importance === "high" ? <AlertTriangleIcon /> : <CheckCircleIcon />}
      </span>
      <div className="finding-body">
        <h4 className="finding-title">{finding.title}</h4>
        <p className="finding-summary">{finding.summary}</p>
        <div className="finding-meta">
          <span>{sectionLabel(view, finding.section)}</span>
          {evidenceCount > 0 && <span>{evidenceCount} source{evidenceCount === 1 ? "" : "s"}</span>}
          {finding.references.length > 0 && (
            <span>{finding.references.length} reference{finding.references.length === 1 ? "" : "s"}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, view, rank }: { action: PriorityAction; view: "aasb" | "esg"; rank: number }) {
  const evidenceCount = action.evidenceIds.length;
  return (
    <div className={"action-card action-card--" + action.priority}>
      <span className="action-rank">{String(rank).padStart(2, "0")}</span>
      <div>
        <div className="action-head">
          <h4 className="action-title">{action.title}</h4>
          <span className={"action-priority action-priority--" + action.priority}>{action.priority}</span>
        </div>
        <p className="action-description">{action.description}</p>
        <div className="action-meta">
          <span>{ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}</span>
          <span>{sectionLabel(view, action.section)}</span>
          {action.reference && <span className="mono">{action.reference}</span>}
          {evidenceCount > 0 && <span>{evidenceCount} source{evidenceCount === 1 ? "" : "s"}</span>}
        </div>
      </div>
    </div>
  );
}
