"use client";

import Link from "next/link";
import { AASB_SECTION_KEYS, AASB_SECTION_LABELS } from "@/lib/assessment-types";
import { Disclosure, type DisclosureItem } from "@/components/Disclosure";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeOffIcon,
  InfoIcon,
  LockIcon,
  SendIcon,
  ShieldIcon,
  XCircleIcon,
} from "@/components/icons";
import { PILLAR_META } from "@/lib/pillar-meta";
import { AASB_AUDIENCE, AASB_INTRO } from "@/lib/report-copy";

const PILLAR_SUMMARIES: Record<(typeof AASB_SECTION_KEYS)[number], string> = {
  governance:
    "Which board or committee oversees climate risk, how often it actually considers climate matters, and how management escalates to it.",
  strategy:
    "The physical and transition risks identified, the time horizons used, and whether scenario analysis (including a 1.5°C or well-below-2°C case) was actually run rather than just mentioned.",
  riskManagement:
    "How climate risk is identified and assessed, and whether that process is integrated into the same enterprise risk management used for everything else, rather than run separately.",
  metricsAndTargets:
    "Scope 1, 2 and 3 emissions figures, the methodology and boundary used, and whether any target has a base year, a target year and a stated scope.",
  generalRequirements:
    "Materiality, fair presentation, comparatives and how consistently metrics are reported over time.",
};

const RATINGS = [
  {
    label: "Present",
    tone: "strong" as const,
    Icon: CheckCircleIcon,
    body: "Every piece of information the criterion requires was found and extracted from the evidence you provided.",
  },
  {
    label: "Partial",
    tone: "partial" as const,
    Icon: AlertTriangleIcon,
    body: "Some, but not all, of the required information was found. This is common when a company discloses that it does something without the specifics the standard actually asks for.",
  },
  {
    label: "Requires human judgement",
    tone: "judgement" as const,
    Icon: ClockIcon,
    body: "Evidence was found, but confirming it actually satisfies the criterion needs a qualified reviewer, not something a checklist can settle on its own.",
  },
  {
    label: "Missing",
    tone: "missing" as const,
    Icon: XCircleIcon,
    body: "None of the required information was found anywhere in the documents provided.",
  },
];

const STEPS = [
  {
    h: "Every criterion has its own checklist.",
    p: "AASB S2 criteria aren't yes/no. Scope 1 emissions, for instance, needs a value, a unit, a reporting period and a boundary, each checked off only when it's backed by evidence extracted from your documents.",
  },
  {
    h: "How much of that checklist is satisfied sets the status.",
    p: "Present when every required element is backed by evidence, Partial when some are, Missing when none are, Requires human judgement when the evidence exists but needs a reviewer to confirm it's enough.",
  },
  {
    h: "Each status carries a fixed weight.",
    p: "Complete counts as 1, evidence requiring judgement as 0.75, partial as 0.5, human confirmation as 0.25, and missing as zero. These fixed weights are published in the report methodology.",
  },
  {
    h: "The overall score is the weighted average across every applicable criterion.",
    p: "Not-applicable criteria are excluded rather than counted as missing, and the score can be capped below what that average implies if something like the reporting period or applicable standard version is still unresolved.",
  },
];

const PRIVACY_ITEMS: DisclosureItem[] = [
  {
    title: "Documents are stored, not discarded",
    teaser: "Uploaded files and the reports built from them are saved to a database.",
    body: "Each file you upload is saved as-is in a database, tied to the company and reporting year you gave it, and deduplicated by content, so uploading the same file twice doesn't create two copies. Reports generated from it are stored the same way and can be reopened using their company and run link, which is why a report keeps working if you reload the page or come back later. Existing reports are retrieved from SQLite without regenerating them.",
    Icon: LockIcon,
  },
  {
    title: "Document text reaches Google's Gemini API",
    teaser: "Gemini reads your documents to produce the assessment.",
    body: "Generating a new assessment sends extracted document text to Google's Gemini API, matched against each AASB S2 criterion. Opening an existing report only retrieves what was already saved; it does not send anything to Gemini again.",
    Icon: SendIcon,
  },
  {
    title: "Run progress is tracked in the same database",
    teaser: "Not an in-memory job queue: the stage is written down as it happens.",
    body: "While a report is generating, its stage (extracting, analysing AASB S2, completed) is recorded in the database so your browser can poll for it. Saved progress and evidence survive a restart. An interrupted analysis needs a new run; it does not automatically resume. Finished runs remain available.",
    Icon: ClockIcon,
  },
  {
    title: "No sign-in, no analytics, no cookies",
    teaser: "Nothing about you or your visit is recorded.",
    body: "There is no account to create and nothing to opt out of: nothing about you or your visit is recorded beyond the ordinary logs any running server produces, and the company/run records described above.",
    Icon: EyeOffIcon,
  },
];

export default function AboutPage() {
  return (
    <div className="surface-dark journey">
      <SiteHeader>
        <Link href="/upload" className="btn btn-primary">
          Generate a report
        </Link>
      </SiteHeader>

      <main className="page page-wide about-intro">
        <div>
          <p
            className="eyebrow rise"
            style={{ ["--i" as string]: 0, fontSize: "clamp(22px, 2.8vw, 28px)" }}
          >
            About GreenScreened
          </p>
          <h1
            className="display rise"
            style={{ ["--i" as string]: 1, marginTop: 10, fontSize: "clamp(28px, 6.8vw, 68px)" }}
          >
            From your documents
            <br />
            to your score
          </h1>
        </div>

        {/* --- what you get -------------------------------------------------- */}
        <section className="about-section" style={{ marginTop: 72 }}>
          <div className="section-head rise" style={{ ["--i" as string]: 3 }}>
            <span className="strip-num">01</span>
            <h2>What you get</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 4, marginBottom: 28, fontSize: 15.5 }}>
            One upload produces a structured AASB S2 readiness assessment for management, directors and assurance review.
          </p>

          <div className="report-kind-grid rise" style={{ ["--i" as string]: 5 }}>
            <div className="panel report-kind-card">
              <div className="report-kind-head">
                <span className="report-kind-icon">
                  <ShieldIcon />
                </span>
                <h3>AASB S2 Climate Readiness</h3>
              </div>
              <div>
                <span className="report-explainer-label">Who it&rsquo;s for</span>
                <p className="report-audience" style={{ marginTop: 0 }}>
                  {AASB_AUDIENCE}
                </p>
              </div>
              <p className="report-kind-body">{AASB_INTRO}</p>
            </div>
          </div>
        </section>

        {/* --- how AASB is calculated ----------------------------------------- */}
        <section className="about-section">
          <div className="section-head rise" style={{ ["--i" as string]: 6 }}>
            <span className="strip-num">02</span>
            <h2>How AASB is calculated</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 7, marginBottom: 28, fontSize: 15.5 }}>
            AASB S2&rsquo;s four core pillars (Governance, Strategy, Risk Management, and Metrics
            &amp; Targets) plus a fifth section of general reporting requirements break down into
            64 individual criteria. Each pillar has its own set of these; your uploaded documents
            are checked against every one of them, criterion by criterion.
          </p>

          <div className="info-grid rise" style={{ ["--i" as string]: 8 }}>
            {AASB_SECTION_KEYS.map((key) => {
              const { colorVar, Icon } = PILLAR_META[key];
              return (
                <div className="info-card" style={{ borderLeftColor: colorVar }} key={key}>
                  <div className="info-card-head">
                    <span
                      className="info-card-icon"
                      style={{ color: colorVar, background: `color-mix(in srgb, ${colorVar} 16%, transparent)` }}
                    >
                      <Icon />
                    </span>
                    <h3>{AASB_SECTION_LABELS[key]}</h3>
                  </div>
                  <p>{PILLAR_SUMMARIES[key]}</p>
                </div>
              );
            })}
          </div>

          <h3 className="subhead rise" style={{ ["--i" as string]: 9 }}>
            What the statuses mean
          </h3>
          <div className="rating-grid rise" style={{ ["--i" as string]: 10 }}>
            {RATINGS.map((r) => (
              <div className={`rating-card rating-card--${r.tone}`} key={r.label}>
                <div className="rating-card-head">
                  <r.Icon />
                  <h3>{r.label}</h3>
                </div>
                <p>{r.body}</p>
              </div>
            ))}
          </div>

          <h3 className="subhead rise" style={{ ["--i" as string]: 11 }}>
            From rating to number
          </h3>
          <div className="step-grid rise" style={{ ["--i" as string]: 12 }}>
            {STEPS.map((step, i) => (
              <div className="step-card" key={step.h}>
                <span className="step-tag">Step {String(i + 1).padStart(2, "0")}</span>
                <h4>{step.h}</h4>
                <p>{step.p}</p>
              </div>
            ))}
          </div>

          <div className="callout rise" style={{ ["--i" as string]: 14, marginTop: 28 }}>
            <span className="callout-icon">
              <InfoIcon />
            </span>
            <div>
              <p className="callout-label">Disclaimer</p>
              <p>
                A Missing status means no supporting evidence was found in the documents provided.
                It is not proof that the underlying practice does not exist, only that it was not
                disclosed anywhere we could read it.
              </p>
            </div>
          </div>
        </section>

        {/* --- privacy & data ------------------------------------------------ */}
        <section className="about-section">
          <div className="section-head rise" style={{ ["--i" as string]: 15 }}>
            <span className="strip-num">03</span>
            <h2>Privacy &amp; your documents</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 16, marginBottom: 28, fontSize: 15.5 }}>
            What actually happens between an upload and a report. Tap any of these for the full
            explanation.
          </p>

          <div className="disclosure-grid rise" style={{ ["--i" as string]: 17 }}>
            {PRIVACY_ITEMS.map((item) => (
              <Disclosure item={item} key={item.title} />
            ))}
          </div>
        </section>

        {/* --- AI policy ------------------------------------------------------ */}
        <section className="about-section" style={{ paddingBottom: 48 }}>
          <div className="section-head rise" style={{ ["--i" as string]: 19 }}>
            <span className="strip-num">04</span>
            <h2>AI policy</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 20, marginBottom: 20, fontSize: 15.5 }}>
            Every judgement in a report, including what a passage says, whether it satisfies a
            criterion, and how confident that reading is, is made by Gemini, not a person. The
            scoring math on top of that judgement is deterministic; the judgement itself is not
            independently verified, beyond one mechanical check.
          </p>
          <div className="callout rise" style={{ ["--i" as string]: 22 }}>
            <span className="callout-icon">
              <AlertTriangleIcon />
            </span>
            <div>
              <p className="callout-label">This is AI, not a compliance sign-off</p>
              <p>
                Nothing in a report has been checked by a human reviewer, an auditor, or a lawyer.
                Treat every finding as a starting point for your own professional review, not as a
                finished disclosure, an assurance opinion, or advice you can act on directly,
                especially before anything here is disclosed externally or lodged with a regulator.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
