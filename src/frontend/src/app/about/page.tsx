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
  XCircleIcon,
} from "@/components/icons";
import { PILLAR_META } from "@/lib/pillar-meta";

// TODO(follow-up): still describes the retired 4-pillar/3-status model in
// places below (RATINGS, STEPS) — content needs a real rewrite for the 5
// AASB sections (64 criteria, 5-state status) and the separate ESG rubric
// (3 categories, 3-state status). Tracked as pending work, not done here.
const PILLAR_SUMMARIES: Record<(typeof AASB_SECTION_KEYS)[number], string> = {
  governance:
    "Which board or committee oversees climate risk, how often it actually considers climate matters, and how management escalates to it.",
  strategy:
    "The physical and transition risks identified, the time horizons used, and whether scenario analysis — including a 1.5°C or well-below-2°C case — was actually run rather than just mentioned.",
  riskManagement:
    "How climate risk is identified and assessed, and whether that process is integrated into the same enterprise risk management used for everything else, rather than run separately.",
  metricsAndTargets:
    "Scope 1, 2 and 3 emissions figures, the methodology and boundary used, and whether any target has a base year, a target year and a stated scope.",
  generalRequirements:
    "Materiality, fair presentation, comparatives and how consistently metrics are reported over time.",
};

const RATINGS = [
  {
    label: "Well-substantiated",
    tone: "strong" as const,
    Icon: CheckCircleIcon,
    body: "The evidence addresses most of the pillar's disclosure criteria with real specifics — names, figures, dates — not general statements of intent.",
  },
  {
    label: "Partial / Vague",
    tone: "partial" as const,
    Icon: AlertTriangleIcon,
    body: "Some criteria are addressed, or addressed only in general terms. Common when a company discloses that it does something without saying how.",
  },
  {
    label: "Missing",
    tone: "missing" as const,
    Icon: XCircleIcon,
    body: "Little or no evidence was found against the pillar's criteria in the documents provided.",
  },
];

const STEPS = [
  {
    h: "The rating sets the starting point.",
    p: "Well-substantiated starts well ahead of Partial, which starts well ahead of Missing.",
  },
  {
    h: "Evidence volume moves it, with fast diminishing returns.",
    p: "A second citation matters far more than a ninth — corroboration confirms a rating, it doesn't inflate one.",
  },
  {
    h: "Confidence nudges it slightly.",
    p: "How sure the model was in each piece of evidence shifts the score a little around that base, up or down.",
  },
  {
    h: "The overall score is a plain average.",
    p: "The four pillar scores are averaged with no weighting — no pillar counts for more than another.",
  },
];

const PRIVACY_ITEMS: DisclosureItem[] = [
  {
    title: "Nothing is stored",
    teaser: "Held in memory only, then it's gone — even the report itself.",
    body: "A file is held in memory only while it is being read, and discarded once evidence has been pulled from it — it is never written to disk. The report that comes back works the same way: it lives only in the browser tab that generated it. Reload the page or close the tab and it is gone. There is no database, no history and no account — download the report first if you want to keep it.",
    Icon: LockIcon,
  },
  {
    title: "Document text reaches Anthropic's API",
    teaser: "Claude reads your documents to produce the assessment.",
    body: "Your documents are read, classified against the four pillars, and turned into the written assessment by Claude, Anthropic's model. That's the material fact about how this works: your content leaves this application to be processed by a third-party model.",
    Icon: SendIcon,
  },
  {
    title: "A short-lived job, not a database",
    teaser: "Progress sits in memory just long enough to finish the report.",
    body: "While a report is generating, its progress sits in the server's memory under a temporary id so your browser can poll for it. This holds at most the 20 most recent jobs across every visitor, oldest evicted first, and all of it is lost on a server restart — it exists to make the upload-and-poll flow work, not to keep anything.",
    Icon: ClockIcon,
  },
  {
    title: "No sign-in, no analytics, no cookies",
    teaser: "Nothing about you or your visit is recorded.",
    body: "There is no account to create and nothing to opt out of — nothing about you or your visit is recorded beyond the ordinary logs any running server produces.",
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
        <div style={{ maxWidth: "56ch" }}>
          <p className="eyebrow rise" style={{ ["--i" as string]: 0 }}>
            About GreenScreened
          </p>
          <h1 className="display display-l rise" style={{ ["--i" as string]: 1 }}>
            From your documents to your score
          </h1>
          <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 18, fontSize: 16.5 }}>
            Here&rsquo;s exactly how a report gets its score, and exactly what happens to the
            documents you upload. No fine print, no black box.
          </p>
        </div>

        {/* --- how scores are calculated ----------------------------------- */}
        <section className="about-section" style={{ marginTop: 72 }}>
          <div className="section-head rise" style={{ ["--i" as string]: 3 }}>
            <span className="strip-num">01</span>
            <h2>How scores are calculated</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 4, marginBottom: 28, fontSize: 15.5 }}>
            Every report is assessed against four pillars, drawn directly from the AASB S2 / TCFD
            disclosure framework.
          </p>

          <div className="info-grid rise" style={{ ["--i" as string]: 5 }}>
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

          <h3 className="subhead rise" style={{ ["--i" as string]: 6 }}>
            What the ratings mean
          </h3>
          <div className="rating-grid rise" style={{ ["--i" as string]: 7 }}>
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

          <h3 className="subhead rise" style={{ ["--i" as string]: 8 }}>
            From rating to number
          </h3>
          <div className="step-grid rise" style={{ ["--i" as string]: 9 }}>
            {STEPS.map((step, i) => (
              <div className="step-card" key={step.h}>
                <span className="step-tag">Step {String(i + 1).padStart(2, "0")}</span>
                <h4>{step.h}</h4>
                <p>{step.p}</p>
              </div>
            ))}
          </div>

          <p className="note rise" style={{ ["--i" as string]: 10, marginTop: 24, maxWidth: "62ch" }}>
            The calculation is deterministic throughout — nothing here is asked of the model, so the
            same evidence always produces the same score. That&rsquo;s why adding a second document
            and re-running moves the number for a reason you can point to.
          </p>

          <div className="callout rise" style={{ ["--i" as string]: 11, marginTop: 28, maxWidth: "62ch" }}>
            <span className="callout-icon">
              <InfoIcon />
            </span>
            <div>
              <p className="callout-label">Worth stating plainly</p>
              <p>
                A Missing rating means no supporting evidence was found in the documents provided —
                it is not proof that the underlying practice does not exist, only that it was not
                disclosed anywhere we could read it.
              </p>
            </div>
          </div>
        </section>

        {/* --- privacy & data ------------------------------------------------ */}
        <section className="about-section" style={{ paddingBottom: 48 }}>
          <div className="section-head rise" style={{ ["--i" as string]: 12 }}>
            <span className="strip-num">02</span>
            <h2>Privacy &amp; your documents</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 13, marginBottom: 28, fontSize: 15.5 }}>
            What actually happens between an upload and a report. Tap any of these for the full
            explanation.
          </p>

          <div className="disclosure-grid rise" style={{ ["--i" as string]: 14 }}>
            {PRIVACY_ITEMS.map((item) => (
              <Disclosure item={item} key={item.title} />
            ))}
          </div>

          <div className="callout rise" style={{ ["--i" as string]: 15, marginTop: 20, maxWidth: "72ch" }}>
            <span className="callout-icon">
              <AlertTriangleIcon />
            </span>
            <div>
              <p className="callout-label">One limitation, stated rather than glossed over</p>
              <p>
                The backend has no authentication, so anyone who could reach it while a report is
                generating could, in principle, read that job&rsquo;s status. Nothing is retained
                afterward and each job is short-lived, so the exposure is narrow — but it is real.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
