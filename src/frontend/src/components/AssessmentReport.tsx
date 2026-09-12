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
  type EsgSectionBlock,
  type EsgStatus,
  type EvidenceItem,
} from "@/lib/assessment-types";

type View = "both" | "aasb" | "esg";

const AASB_STATUS_META: Record<AasbStatus, { label: string; className: string }> = {
  present: { label: "Present", className: "status-present" },
  partial: { label: "Partial", className: "status-partial" },
  missing: { label: "Missing", className: "status-missing" },
  not_applicable: { label: "Not applicable", className: "status-neutral" },
  requires_human_judgement: { label: "Needs review", className: "status-judgement" },
};

const ESG_STATUS_META: Record<EsgStatus, { label: string; className: string }> = {
  strong: { label: "Strong", className: "status-strong" },
  partial: { label: "Partial", className: "status-partial" },
  missing: { label: "Missing", className: "status-missing" },
};

const AASB_INTRO =
  "AASB S2 is Australia's mandatory climate-related disclosure standard — legislated, effective for reporting periods from 2025, and based on the international ISSB framework. It requires companies to report across four pillars: Governance, Strategy, Risk Management, and Metrics & Targets. Our Climate Readiness Report scores a company against exactly these four pillars, using its own uploaded documentation as evidence, showing where disclosure is strong and where it falls short of what the standard actually requires.";

const ESG_INTRO =
  "Before a company can credibly claim anything about its ESG performance, it needs to be able to back that claim with real, traceable evidence — not just a statement of intent. This report is the evidence layer underneath the readiness score: it shows exactly what supporting material exists for each ESG claim, how strong that evidence actually is, and where claims currently rest on nothing verifiable.";

const AI_DISCLAIMER =
  "This Disclosure Report was generated with AI assistance: language models read the documents a company uploaded, matched them against each AASB S2 and ESG criterion, and cited the exact passages used as evidence. Every quoted citation is verified as an exact excerpt of the source text before it is shown here — nothing is fabricated — but the underlying judgement, whether a given passage actually satisfies a criterion, is machine-made and has not been reviewed by a qualified assurance practitioner. This report is a readiness diagnostic, not a substitute for professional assurance, legal advice, or a lodgement-ready statutory disclosure.";

const FOUR_PILLARS: Array<{ key: string; label: string; copy: string }> = [
  {
    key: "governance",
    label: "Governance",
    copy: "The oversight structures a company has in place for climate-related risks and opportunities — who on the board and in management is responsible, how often they review climate matters, and how climate considerations feed into strategy and risk decisions.",
  },
  {
    key: "strategy",
    label: "Strategy",
    copy: "How climate-related risks and opportunities actually affect the business — its operations, strategy and financial planning — including resilience under different climate scenarios and the transition plan toward a lower-carbon economy.",
  },
  {
    key: "riskManagement",
    label: "Risk Management",
    copy: "The processes a company uses to identify, assess and manage climate-related risks, and how those processes are integrated into its overall enterprise risk management framework.",
  },
  {
    key: "metricsAndTargets",
    label: "Metrics & Targets",
    copy: "The metrics a company uses to track climate-related performance — including Scope 1, 2 and 3 greenhouse gas emissions — and the targets it has set to manage climate risks and pursue opportunities.",
  },
];

const CITATION_PREVIEW_COUNT = 2;
const CITATION_MAX_CHARS = 220;

function truncateText(text: string, maxChars = CITATION_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars).trimEnd()}…`;
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

const ESG_SECTIONS: Array<{ key: "environmental" | "social" | "governance"; label: string }> = [
  { key: "environmental", label: "Environmental" },
  { key: "social", label: "Social" },
  { key: "governance", label: "Governance" },
];

/**
 * The page shows two very different things under one component:
 *
 * - The on-screen Readiness Overview — scores, key findings, priority
 *   actions only. This is what a visitor sees without downloading anything.
 * - The Disclosure Report — the full section-by-section document, built to
 *   the same depth as a real AASB S2 readiness PDF. It only ever renders
 *   for print/download (`.print-only`, hidden on screen by CSS), so the
 *   live page never pays for or shows all 64 criteria at once.
 *
 * Both trees are mounted at all times; only CSS decides which one a given
 * medium (screen vs print) shows. That means Download can just call
 * `window.print()` — no re-render race to wait out — except for which
 * report(s) go into that PDF, which is a `data-target` attribute flipped
 * before printing (the one piece of state print output actually depends on).
 */
export function AssessmentReport({
  aasbS2Report,
  esgReport,
}: {
  aasbS2Report: AasbS2Report;
  esgReport: EsgReport;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<View>("both");

  function download(target: View) {
    setMenuOpen(false);
    setPrintTarget(target);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  const company = aasbS2Report.company || esgReport.company;

  return (
    <>
      <div className="report-controls no-print">
        <p className="report-controls-label">Readiness Overview</p>

        <div className="download-menu">
          <button className="btn btn-primary" onClick={() => setMenuOpen((v) => !v)}>
            Download the Disclosure Report
          </button>
          {menuOpen && (
            <div className="download-menu-list">
              <button onClick={() => download("both")}>Full Disclosure Report (AASB S2 + ESG)</button>
              <button onClick={() => download("aasb")}>AASB S2 Disclosure Report only</button>
              <button onClick={() => download("esg")}>ESG Disclosure Report only</button>
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

          <ReportOverview
            aasbS2Report={aasbS2Report}
            esgReport={esgReport}
            onDownload={() => download("both")}
          />

          <div className="disclosure-report print-only" data-target={printTarget}>
            <DisclosureReport aasbS2Report={aasbS2Report} esgReport={esgReport} />
          </div>
        </article>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Readiness Overview — the on-screen view. Scores, key findings, priority
   actions only; everything else lives in the downloaded Disclosure Report.
   --------------------------------------------------------------------------- */

function ReportOverview({
  aasbS2Report,
  esgReport,
  onDownload,
}: {
  aasbS2Report: AasbS2Report;
  esgReport: EsgReport;
  onDownload: () => void;
}) {
  const pillarScores = AASB_SECTION_KEYS.map((key) => {
    const block = aasbS2Report[key] as AasbSectionBlock;
    return {
      key,
      label: AASB_SECTION_LABELS[key],
      score: sectionScore(block.criteria, aasbS2Report.methodology.weights),
      status: block.overallStatus,
    };
  });

  const actions = [
    ...aasbS2Report.priorityActions.map((a) => ({ ...a, source: "AASB S2" })),
    ...esgReport.priorityActions.map((a) => ({ ...a, source: "ESG" })),
  ].slice(0, 8);

  return (
    <section className="report-overview">
      <div className="overview-scores">
        <div className="overview-score-card">
          <span className="overview-score-value">{aasbS2Report.aasbS2ReadinessScore ?? "—"}</span>
          <span className="overview-score-label">AASB S2 readiness</span>
        </div>
        <div className="overview-score-card">
          <span className="overview-score-value">{esgReport.overallESGScore}</span>
          <span className="overview-score-label">ESG evidence readiness</span>
        </div>
      </div>

      <div className="overview-pillars">
        {pillarScores.map((p) => (
          <div className="overview-pillar" key={p.key}>
            <span className="overview-pillar-label">{p.label}</span>
            <span className="overview-pillar-score">{p.score ?? "—"}</span>
            <span className={`status-label ${AASB_STATUS_META[p.status].className}`}>
              {AASB_STATUS_META[p.status].label}
            </span>
          </div>
        ))}
      </div>

      <h3 className="overview-heading">Key findings</h3>
      <p className="report-executive-summary">{aasbS2Report.executiveSummary.assessment}</p>
      <p className="report-executive-summary">{esgReport.executiveSummary}</p>

      {actions.length > 0 && (
        <>
          <h3 className="overview-heading">Priority actions</h3>
          <ol className="overview-actions">
            {actions.map((a, i) => (
              <li key={i}>
                <span className="overview-action-source">{a.source}</span>
                {a.action}
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="overview-cta-note">
        This is a summary.{" "}
        <button className="link-button" onClick={onDownload}>
          Download the full Disclosure Report
        </button>{" "}
        for the complete criterion-by-criterion evidence review.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Disclosure Report — the full downloadable document. Print-only; laid out
   top-down exactly as required: AASB overview, the four pillars explained,
   an AI disclaimer, an executive summary, prioritised action points, then a
   section-by-section review with a criteria table and a truncated
   evidence snapshot per criterion, followed by assurance/lodgement,
   the evidence register, and the methodology appendix.
   --------------------------------------------------------------------------- */

function DisclosureReport({ aasbS2Report, esgReport }: { aasbS2Report: AasbS2Report; esgReport: EsgReport }) {
  return (
    <>
      <DisclosureSection number="1" title="About AASB S2">
        <p className="report-type-sub">{AASB_INTRO}</p>
      </DisclosureSection>

      <DisclosureSection number="2" title="Understanding the four pillars">
        {FOUR_PILLARS.map((p) => (
          <div className="pillar-explainer" key={p.key}>
            <h4>{p.label}</h4>
            <p>{p.copy}</p>
          </div>
        ))}
      </DisclosureSection>

      <DisclosureSection number="3" title="How this report was produced">
        <p className="disclaimer-box">{AI_DISCLAIMER}</p>
      </DisclosureSection>

      <DisclosureSection number="4" title="Executive summary">
        <ExecutiveSummaryTable report={aasbS2Report} />
        <p className="report-executive-summary">{aasbS2Report.executiveSummary.assessment}</p>
        {aasbS2Report.warnings.length > 0 && (
          <>
            <p className="disclosure-subhead">Warnings</p>
            <ul className="actions-list">
              {aasbS2Report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </>
        )}
      </DisclosureSection>

      <DisclosureSection number="5" title="Priority actions">
        <ActionsList actions={aasbS2Report.priorityActions} esgActions={esgReport.priorityActions} />
      </DisclosureSection>

      <DisclosureSection number="6" title="Section-by-section review — AASB S2" className="disclosure-aasb">
        <p className="report-type-sub">
          Climate-related disclosure, assessed criterion by criterion against AASB S2.
        </p>
        {AASB_SECTION_KEYS.map((key, i) => (
          <SectionReview
            key={key}
            number={`6.${i + 1}`}
            label={AASB_SECTION_LABELS[key]}
            block={aasbS2Report[key] as AasbSectionBlock}
            weights={aasbS2Report.methodology.weights}
          />
        ))}
      </DisclosureSection>

      <DisclosureSection number="7" title="Section-by-section review — ESG evidence" className="disclosure-esg">
        <p className="report-type-sub">{ESG_INTRO}</p>
        {ESG_SECTIONS.map(({ key, label }, i) => (
          <EsgSectionReview key={key} number={`7.${i + 1}`} label={label} block={esgReport[key]} />
        ))}
      </DisclosureSection>

      <DisclosureSection number="8" title="Assurance, directors and lodgement">
        <AssuranceBlock report={aasbS2Report} />
      </DisclosureSection>

      <DisclosureSection number="A" title="Appendix A — Evidence register">
        <EvidenceRegister items={aasbS2Report.evidenceRegister} />
      </DisclosureSection>

      <DisclosureSection number="B" title="Appendix B — Methodology">
        <MethodologyBlock methodology={aasbS2Report.methodology} />
      </DisclosureSection>
    </>
  );
}

function DisclosureSection({
  number,
  title,
  className,
  children,
}: {
  number: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`disclosure-section ${className ?? ""}`}>
      <div className="report-type-heading">
        <span className="criterion-group-number">{number}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ExecutiveSummaryTable({ report }: { report: AasbS2Report }) {
  const rows: Array<[string, string]> = [
    ["Report status", report.status],
    ["Standard", `${report.standard.name} ${report.standard.version}`],
    ["Readiness score", report.aasbS2ReadinessScore != null ? `${report.aasbS2ReadinessScore} / 100` : "—"],
    ["Criteria present", `${report.executiveSummary.presentCriteria} of ${report.executiveSummary.totalCriteria}`],
    ["Criteria requiring action", String(report.executiveSummary.criteriaRequiringAction)],
    ["Reporting applicability", report.reportingApplicability.assessment],
    ["Assurance status", report.assuranceReadiness.status],
    ["Lodgement ready", report.lodgement.lodgementReady ? "Yes" : "No"],
  ];

  return (
    <table className="kv-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActionsList({
  actions,
  esgActions,
}: {
  actions: AasbS2Report["priorityActions"];
  esgActions: EsgReport["priorityActions"];
}) {
  return (
    <>
      {actions.length > 0 && (
        <ol className="actions-list">
          {actions.map((a, i) => (
            <li key={i}>
              <span className="mono">{a.criterionId}</span> — {a.action}
            </li>
          ))}
        </ol>
      )}
      {esgActions.length > 0 && (
        <>
          <p className="disclosure-subhead">ESG priority actions</p>
          <ol className="actions-list">
            {esgActions.map((a, i) => (
              <li key={i}>
                <span className="mono">{a.criterionId}</span> — {a.action}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function SectionReview({
  number,
  label,
  block,
  weights,
}: {
  number: string;
  label: string;
  block: AasbSectionBlock;
  weights: Record<string, number>;
}) {
  const score = sectionScore(block.criteria, weights);

  return (
    <div className="criterion-group">
      <div className="criterion-group-head">
        <span className="criterion-group-number">{number}</span>
        <h3>{label}</h3>
        {score !== null && (
          <span className="criterion-group-score">
            {score}
            <span>/100</span>
          </span>
        )}
        <span className={`status-label ${AASB_STATUS_META[block.overallStatus].className}`}>
          {AASB_STATUS_META[block.overallStatus].label}
        </span>
      </div>

      <table className="criteria-table">
        <thead>
          <tr>
            <th>Criterion</th>
            <th>Ref.</th>
            <th>Status</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {block.criteria.map((c, i) => (
            <tr key={c.id}>
              <td>
                {number}.{i + 1} {c.description}
              </td>
              <td className="mono">{c.reference}</td>
              <td>
                <span className={`status-label ${AASB_STATUS_META[c.status].className}`}>
                  {AASB_STATUS_META[c.status].label}
                </span>
              </td>
              <td>{c.citations.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="evidence-snapshot-heading">Evidence snapshot</p>
      {block.criteria.map((c, i) => (
        <CriterionSnapshot key={c.id} number={`${number}.${i + 1}`} criterion={c} />
      ))}
    </div>
  );
}

function CriterionSnapshot({ number, criterion }: { number: string; criterion: AasbCriterion }) {
  const meta = AASB_STATUS_META[criterion.status];
  const shown = criterion.citations.slice(0, CITATION_PREVIEW_COUNT);
  const remaining = criterion.citations.length - shown.length;

  return (
    <div className="criterion-snapshot">
      <p className="criterion-snapshot-head">
        <span className="criterion-number">{number}</span> {criterion.description}
      </p>
      <p className="criterion-snapshot-meta">
        Reference: <span className="mono">AASB S2 ¶{criterion.reference}</span> · Status:{" "}
        <span className={`status-label ${meta.className}`}>{meta.label}</span>
      </p>
      <p className="criterion-snapshot-finding">{criterion.finding}</p>

      {shown.length > 0 && (
        <div className="citations">
          {shown.map((c, i) => (
            <div className="citation" key={i}>
              <div className="citation-source">
                <span className="citation-id">{c.evidenceId}</span>
              </div>
              <p className="citation-snippet">&ldquo;{truncateText(c.quote)}&rdquo;</p>
            </div>
          ))}
          {remaining > 0 && (
            <p className="citation-more">
              + {remaining} additional citation{remaining === 1 ? "" : "s"} in source JSON.
            </p>
          )}
        </div>
      )}

      {criterion.requiredInformation.map((r) => (
        <p className="criterion-required" key={r}>
          {r}
        </p>
      ))}
    </div>
  );
}

function EsgSectionReview({ number, label, block }: { number: string; label: string; block: EsgSectionBlock }) {
  const meta = ESG_STATUS_META[block.status];

  return (
    <div className="criterion-group">
      <div className="criterion-group-head">
        <span className="criterion-group-number">{number}</span>
        <h3>{label}</h3>
        <span className="criterion-group-score">
          {block.score}
          <span>/100</span>
        </span>
        <span className={`status-label ${meta.className}`}>{meta.label}</span>
      </div>

      <table className="criteria-table">
        <thead>
          <tr>
            <th>Criterion</th>
            <th>Status</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {block.criteria.map((c, i) => (
            <tr key={c.id}>
              <td>
                {number}.{i + 1} {c.description}
              </td>
              <td>
                <span className={`status-label ${ESG_STATUS_META[c.status].className}`}>
                  {ESG_STATUS_META[c.status].label}
                </span>
              </td>
              <td>{c.citations.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="evidence-snapshot-heading">Evidence snapshot</p>
      {block.criteria.map((c, i) => (
        <EsgCriterionSnapshot key={c.id} number={`${number}.${i + 1}`} criterion={c} />
      ))}
    </div>
  );
}

function EsgCriterionSnapshot({ number, criterion }: { number: string; criterion: EsgCriterion }) {
  const meta = ESG_STATUS_META[criterion.status];
  const shown = criterion.citations.slice(0, CITATION_PREVIEW_COUNT);
  const remaining = criterion.citations.length - shown.length;

  return (
    <div className="criterion-snapshot">
      <p className="criterion-snapshot-head">
        <span className="criterion-number">{number}</span> {criterion.description}
      </p>
      <p className="criterion-snapshot-meta">
        Status: <span className={`status-label ${meta.className}`}>{meta.label}</span>
      </p>
      {criterion.recommendation && <p className="criterion-snapshot-finding">{criterion.recommendation}</p>}

      {shown.length > 0 && (
        <div className="citations">
          {shown.map((c, i) => (
            <div className="citation" key={i}>
              <div className="citation-source">
                <span className="citation-id">{c.evidenceId}</span>
              </div>
              <p className="citation-snippet">&ldquo;{truncateText(c.quote)}&rdquo;</p>
            </div>
          ))}
          {remaining > 0 && (
            <p className="citation-more">
              + {remaining} additional citation{remaining === 1 ? "" : "s"} in source JSON.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AssuranceBlock({ report }: { report: AasbS2Report }) {
  return (
    <table className="kv-table">
      <tbody>
        <tr>
          <th>Assurance status</th>
          <td>{report.assuranceReadiness.status}</td>
        </tr>
        {report.assuranceReadiness.issues.length > 0 && (
          <tr>
            <th>Assurance issues</th>
            <td>
              <ul>
                {report.assuranceReadiness.issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            </td>
          </tr>
        )}
        <tr>
          <th>Directors&rsquo; declaration required</th>
          <td>{report.directorsDeclaration.requiredForStatutoryReport ? "Yes" : "No"}</td>
        </tr>
        <tr>
          <th>Directors&rsquo; declaration status</th>
          <td>{report.directorsDeclaration.status}</td>
        </tr>
        <tr>
          <th>Directors&rsquo; declaration note</th>
          <td>{report.directorsDeclaration.note}</td>
        </tr>
        <tr>
          <th>Lodgement ready</th>
          <td>{report.lodgement.lodgementReady ? "Yes" : "No"}</td>
        </tr>
        {report.lodgement.notes.length > 0 && (
          <tr>
            <th>Lodgement notes</th>
            <td>
              <ul>
                {report.lodgement.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function EvidenceRegister({ items }: { items: EvidenceItem[] }) {
  return (
    <table className="evidence-register-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Source</th>
          <th>Pages</th>
          <th>Confidence</th>
          <th>Preview</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="mono">{item.id}</td>
            <td>{item.source ?? "—"}</td>
            <td>{item.pages.length ? item.pages.join(", ") : "—"}</td>
            <td>{item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}</td>
            <td>{truncateText(item.text, 140)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MethodologyBlock({ methodology }: { methodology: AasbS2Report["methodology"] }) {
  return (
    <table className="kv-table">
      <tbody>
        <tr>
          <th>Version</th>
          <td>{methodology.version}</td>
        </tr>
        <tr>
          <th>Score meaning</th>
          <td>{methodology.scoreMeaning}</td>
        </tr>
        <tr>
          <th>Weights</th>
          <td>
            <ul className="weights-list">
              {Object.entries(methodology.weights).map(([k, v]) => (
                <li key={k}>
                  <span className="mono">{k}</span>: {v}
                </li>
              ))}
            </ul>
          </td>
        </tr>
        <tr>
          <th>Limitations</th>
          <td>{methodology.limitations}</td>
        </tr>
        {methodology.source && (
          <tr>
            <th>Source</th>
            <td>{methodology.source}</td>
          </tr>
        )}
        {methodology.humanInputs != null && (
          <tr>
            <th>Human inputs</th>
            <td>{JSON.stringify(methodology.humanInputs)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
