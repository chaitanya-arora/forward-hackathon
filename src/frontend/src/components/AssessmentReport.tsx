"use client";

import { useState } from "react";
import {
  AASB_SECTION_KEYS,
  AASB_SECTION_LABELS,
  type AasbCriterion,
  type AasbS2Report,
  type AasbSectionBlock,
  type AasbStatus,
  type EsgCriterion,
  type EsgReport,
  type EsgStatus,
} from "@/lib/assessment-types";
import { PILLAR_META } from "@/lib/pillar-meta";

type View = "both" | "aasb" | "esg";

const AASB_STATUS_META: Record<AasbStatus, { label: string; badge: string; dot: string }> = {
  present: { label: "Present", badge: "badge-strong", dot: "var(--strong)" },
  partial: { label: "Partial", badge: "badge-partial", dot: "var(--partial)" },
  missing: { label: "Missing", badge: "badge-missing", dot: "var(--missing)" },
  not_applicable: { label: "Not applicable", badge: "badge-neutral", dot: "var(--neutral)" },
  requires_human_judgement: { label: "Needs review", badge: "badge-judgement", dot: "var(--judgement)" },
};

const ESG_STATUS_META: Record<EsgStatus, { label: string; badge: string; dot: string }> = {
  strong: { label: "Strong", badge: "badge-strong", dot: "var(--strong)" },
  partial: { label: "Partial", badge: "badge-partial", dot: "var(--partial)" },
  missing: { label: "Missing", badge: "badge-missing", dot: "var(--missing)" },
};

function tally<T extends string>(items: { status: T }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}

/**
 * The real backend only computes one overall AASB score across all 64
 * criteria — there is no per-section score in the data. This applies the
 * exact same public formula (report.methodology.weights) to just one
 * section's criteria, which is legitimate — the same known weights, a
 * narrower scope — not an invented number.
 */
function sectionScore(criteria: AasbCriterion[], weights: Record<string, number>): number | null {
  const scored = criteria.filter((c) => c.status !== "not_applicable");
  if (!scored.length) return null;
  return Math.round((scored.reduce((sum, c) => sum + (weights[c.status] ?? 0), 0) / scored.length) * 100);
}

/**
 * The actual deliverable is a downloaded PDF, so the document itself (this
 * component) has no expand/collapse anywhere — a PDF cannot have interactive
 * disclosure widgets, and Download just prints whatever is currently
 * visible. Everything here always renders in full. The view toggle and
 * download menu are page chrome around the document, not part of it, and
 * that's the only interactivity in this file.
 */
export function AssessmentReport({
  aasbS2Report,
  esgReport,
}: {
  aasbS2Report: AasbS2Report;
  esgReport: EsgReport;
}) {
  const [view, setView] = useState<View>("both");
  const [menuOpen, setMenuOpen] = useState(false);

  const showAasb = view !== "esg";
  const showEsg = view !== "aasb";

  function downloadAs(target: View) {
    setMenuOpen(false);
    setView(target);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  const company = aasbS2Report.company || esgReport.company;

  return (
    <>
      <div className="report-controls no-print">
        <div className="view-toggle" role="tablist" aria-label="Report view">
          {(
            [
              ["both", "Both reports"],
              ["aasb", "AASB S2 only"],
              ["esg", "ESG only"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className={view === key ? "is-active" : ""}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="download-menu">
          <button className="btn btn-primary" onClick={() => setMenuOpen((v) => !v)}>
            Download
          </button>
          {menuOpen && (
            <div className="download-menu-list">
              <button onClick={() => downloadAs("aasb")}>AASB S2 report only</button>
              <button onClick={() => downloadAs("esg")}>ESG report only</button>
              <button onClick={() => downloadAs("both")}>Both reports</button>
            </div>
          )}
        </div>
      </div>

      <div className="paper-sheet">
        <article className="report">
          <header className="report-masthead">
            <p className="report-kicker">Climate &amp; ESG Readiness Assessment</p>
            <h1 className="report-company">{company}</h1>
            <p className="report-dateline">
              AASB S2 climate disclosure draft, reporting year {aasbS2Report.reportingPeriod.year} · plus
              a secondary ESG evidence-readiness assessment
            </p>
          </header>

          {showAasb && <AasbReportSection report={aasbS2Report} />}
          {showEsg && <EsgReportSection report={esgReport} />}
        </article>
      </div>
    </>
  );
}

function AasbReportSection({ report }: { report: AasbS2Report }) {
  return (
    <section className="report-block">
      <div className="report-type-heading">
        <h2>AASB S2 Climate Readiness</h2>
      </div>
      <p className="report-type-sub">
        A preparation and readiness draft against the AASB S2 Climate-related Disclosures standard —
        {" "}
        {report.executiveSummary.totalCriteria} criteria across five sections.
      </p>

      <div className="aasb-stats">
        <div className="aasb-stat">
          <b>{report.aasbS2ReadinessScore ?? "—"}</b>
          <span>Readiness score</span>
        </div>
        <div className="aasb-stat">
          <b>{report.executiveSummary.presentCriteria}</b>
          <span>Present</span>
        </div>
        <div className="aasb-stat">
          <b>{report.executiveSummary.criteriaRequiringAction}</b>
          <span>Need action</span>
        </div>
        <div className="aasb-stat">
          <b>{report.executiveSummary.excludedCriteria}</b>
          <span>Excluded</span>
        </div>
      </div>

      {AASB_SECTION_KEYS.map((key) => (
        <CriterionGroup
          key={key}
          sectionKey={key}
          label={AASB_SECTION_LABELS[key]}
          block={report[key] as AasbSectionBlock}
          weights={report.methodology.weights}
        />
      ))}
    </section>
  );
}

function CriterionGroup({
  sectionKey,
  label,
  block,
  weights,
}: {
  sectionKey: (typeof AASB_SECTION_KEYS)[number];
  label: string;
  block: AasbSectionBlock;
  weights: Record<string, number>;
}) {
  const counts = tally(block.criteria);
  const score = sectionScore(block.criteria, weights);
  const { colorVar, Icon } = PILLAR_META[sectionKey];

  return (
    <div className="criterion-group" style={{ borderLeftColor: colorVar }}>
      <div className="criterion-group-head">
        <span
          className="criterion-group-icon"
          style={{ color: colorVar, background: `color-mix(in srgb, ${colorVar} 16%, transparent)` }}
        >
          <Icon />
        </span>
        <h3>{label}</h3>
        {score !== null && (
          <span className="criterion-group-score">
            {score}
            <span>/100</span>
          </span>
        )}
        <span className={`badge ${AASB_STATUS_META[block.overallStatus].badge}`}>
          {AASB_STATUS_META[block.overallStatus].label}
        </span>
        <span className="criterion-tally">
          {Object.entries(counts).map(([status, n]) => (
            <span key={status}>
              {n} {AASB_STATUS_META[status as AasbStatus].label.toLowerCase()}
            </span>
          ))}
        </span>
      </div>

      <div className="criterion-list">
        {block.criteria.map((c) => (
          <CriterionRow key={c.id} criterion={c} />
        ))}
      </div>
    </div>
  );
}

function CriterionRow({ criterion }: { criterion: AasbCriterion }) {
  const meta = AASB_STATUS_META[criterion.status];

  return (
    <div className="criterion-row">
      <div className="criterion-row-head">
        <span className="criterion-dot" style={{ background: meta.dot }} />
        <p>{criterion.description}</p>
        <span className={`badge ${meta.badge}`}>{meta.label}</span>
        <span className="criterion-ref">{criterion.reference}</span>
      </div>

      <div className="criterion-detail">
        <p>{criterion.finding}</p>
        {criterion.citations.map((c, i) => (
          <div className="citation" key={i}>
            <div className="citation-source">
              <span className="citation-id">{c.evidenceId}</span>
            </div>
            <p className="citation-snippet">&ldquo;{c.quote}&rdquo;</p>
          </div>
        ))}
        {criterion.requiredInformation.map((r) => (
          <p className="criterion-required" key={r}>
            {r}
          </p>
        ))}
      </div>
    </div>
  );
}

const ESG_SECTIONS: Array<{ key: "environmental" | "social" | "governance"; label: string }> = [
  { key: "environmental", label: "Environmental" },
  { key: "social", label: "Social" },
  { key: "governance", label: "Governance" },
];

function EsgReportSection({ report }: { report: EsgReport }) {
  return (
    <section className="report-block">
      <div className="report-type-heading">
        <h2>ESG Evidence Readiness</h2>
      </div>
      <p className="report-type-sub">{report.executiveSummary}</p>

      <div className="aasb-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))" }}>
        <div className="aasb-stat">
          <b>{report.overallESGScore}</b>
          <span>Overall ESG score</span>
        </div>
      </div>

      {ESG_SECTIONS.map(({ key, label }) => {
        const block = report[key];
        const meta = ESG_STATUS_META[block.status];
        return (
          <div className="criterion-group" key={key} style={{ borderLeftColor: "var(--rule-strong)" }}>
            <div className="criterion-group-head">
              <h3>{label}</h3>
              <span className="criterion-group-score">
                {block.score}
                <span>/100</span>
              </span>
              <span className={`badge ${meta.badge}`}>{meta.label}</span>
            </div>
            <div className="criterion-list">
              {block.criteria.map((c) => (
                <EsgCriterionRow key={c.id} criterion={c} />
              ))}
            </div>
          </div>
        );
      })}

      {report.priorityActions.length > 0 && (
        <>
          <h3 className="subhead">Priority actions</h3>
          <div className="recs">
            {report.priorityActions.slice(0, 6).map((a, i) => (
              <div className="rec" key={i}>
                <div>
                  <p className="rec-text">{a.action}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EsgCriterionRow({ criterion }: { criterion: EsgCriterion }) {
  const meta = ESG_STATUS_META[criterion.status];

  return (
    <div className="criterion-row">
      <div className="criterion-row-head">
        <span className="criterion-dot" style={{ background: meta.dot }} />
        <p>{criterion.description}</p>
        <span className={`badge ${meta.badge}`}>{meta.label}</span>
      </div>

      {criterion.citations.length > 0 && (
        <div className="criterion-detail">
          {criterion.citations.map((c, i) => (
            <div className="citation" key={i}>
              <div className="citation-source">
                <span className="citation-id">{c.evidenceId}</span>
              </div>
              <p className="citation-snippet">&ldquo;{c.quote}&rdquo;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
