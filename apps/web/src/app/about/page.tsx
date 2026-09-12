import Link from "next/link";
import { PILLAR_KEYS, PILLAR_LABELS } from "@climate/contract";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const PILLAR_SUMMARIES: Record<(typeof PILLAR_KEYS)[number], string> = {
  governance:
    "Which board or committee oversees climate risk, how often it actually considers climate matters, and how management escalates to it.",
  strategy:
    "The physical and transition risks identified, the time horizons used, and whether scenario analysis — including a 1.5°C or well-below-2°C case — was actually run rather than just mentioned.",
  risk_management:
    "How climate risk is identified and assessed, and whether that process is integrated into the same enterprise risk management used for everything else, rather than run separately.",
  metrics_targets:
    "Scope 1, 2 and 3 emissions figures, the methodology and boundary used, and whether any target has a base year, a target year and a stated scope.",
};

const RATINGS = [
  {
    label: "Well-substantiated",
    tone: "strong" as const,
    body: "The evidence addresses most of the pillar's disclosure criteria with real specifics — names, figures, dates — not general statements of intent.",
  },
  {
    label: "Partial / Vague",
    tone: "partial" as const,
    body: "Some criteria are addressed, or addressed only in general terms. Common when a company discloses that it does something without saying how.",
  },
  {
    label: "Missing",
    tone: "missing" as const,
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

const PRIVACY_POINTS = [
  {
    h: "Nothing is stored",
    p: "A file is held in memory only while it is being read, and discarded once evidence has been pulled from it — it is never written to disk.",
  },
  {
    h: "The report lives only in your tab",
    p: "There is no database, no history and no account. Reload the page or close the tab and it is gone — download it first if you want to keep it.",
  },
  {
    h: "Document text reaches Anthropic's API",
    p: "Your documents are read, classified against the four pillars, and turned into the written assessment by Claude. Your content leaves this application to be processed by a third-party model.",
  },
  {
    h: "A short-lived job, not a database",
    p: "While a report is generating, its progress sits in server memory under a temporary id so your browser can poll for it — at most the 20 most recent jobs across every visitor, oldest evicted first, all lost on a restart.",
  },
  {
    h: "No sign-in, no analytics, no cookies",
    p: "Nothing about you or your visit is recorded beyond the ordinary logs any running server produces.",
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

      <main className="page page-wide">
        <div style={{ maxWidth: "62ch" }}>
          <p className="eyebrow rise" style={{ ["--i" as string]: 0 }}>
            About GreenScreen
          </p>
          <h1 className="display display-l rise" style={{ ["--i" as string]: 1, fontSize: "clamp(32px, 5vw, 46px)" }}>
            How the report is built, and what happens to your documents
          </h1>
          <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 18 }}>
            Two plain explanations, not a legal notice and not a black box: how a score gets to the
            number it lands on, and what actually happens to a file between the moment you drop it in
            and the moment the report comes back.
          </p>
        </div>

        {/* --- how scores are calculated ----------------------------------- */}
        <section style={{ marginTop: 68 }}>
          <div className="section-head rise" style={{ ["--i" as string]: 3 }}>
            <span className="strip-num">01</span>
            <h2>How scores are calculated</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 4, marginBottom: 28, fontSize: 15.5 }}>
            Every report is assessed against four pillars, drawn directly from the AASB S2 / TCFD
            disclosure framework.
          </p>

          <div className="info-grid rise" style={{ ["--i" as string]: 5 }}>
            {PILLAR_KEYS.map((key) => (
              <div className="info-card" key={key}>
                <h3>{PILLAR_LABELS[key]}</h3>
                <p>{PILLAR_SUMMARIES[key]}</p>
              </div>
            ))}
          </div>

          <h3
            className="rise"
            style={{
              ["--i" as string]: 6,
              fontFamily: "var(--serif)",
              fontSize: 20,
              fontWeight: 600,
              margin: "44px 0 16px",
            }}
          >
            What the ratings mean
          </h3>
          <div className="rating-grid rise" style={{ ["--i" as string]: 7 }}>
            {RATINGS.map((r) => (
              <div className={`rating-card rating-card--${r.tone}`} key={r.label}>
                <h3>{r.label}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>

          <h3
            className="rise"
            style={{
              ["--i" as string]: 8,
              fontFamily: "var(--serif)",
              fontSize: 20,
              fontWeight: 600,
              margin: "44px 0 16px",
            }}
          >
            From rating to number
          </h3>
          <div className="step-grid rise" style={{ ["--i" as string]: 9 }}>
            {STEPS.map((step, i) => (
              <div className="step-card" key={step.h}>
                <span className="step-index">{String(i + 1).padStart(2, "0")}</span>
                <h4>{step.h}</h4>
                <p>{step.p}</p>
              </div>
            ))}
          </div>

          <p className="note rise" style={{ ["--i" as string]: 10, marginTop: 24, maxWidth: "62ch" }}>
            The calculation is deterministic throughout — nothing here is asked of the model, so the
            same evidence always produces the same score. That's why adding a second document and
            re-running moves the number for a reason you can point to.
          </p>

          <div className="callout rise" style={{ ["--i" as string]: 11, marginTop: 28, maxWidth: "62ch" }}>
            <p className="callout-label">Worth stating plainly</p>
            <p>
              A Missing rating means no supporting evidence was found in the documents provided — it
              is not proof that the underlying practice does not exist, only that it was not
              disclosed anywhere we could read it.
            </p>
          </div>
        </section>

        {/* --- privacy & data ------------------------------------------------ */}
        <section style={{ marginTop: 76, paddingBottom: 40 }}>
          <div className="section-head rise" style={{ ["--i" as string]: 12 }}>
            <span className="strip-num">02</span>
            <h2>Privacy &amp; your documents</h2>
          </div>
          <p className="lede rise" style={{ ["--i" as string]: 13, marginBottom: 28, fontSize: 15.5 }}>
            What actually happens between an upload and a report, stated plainly rather than left
            implicit.
          </p>

          <div className="info-grid info-grid--2 rise" style={{ ["--i" as string]: 14 }}>
            {PRIVACY_POINTS.map((point) => (
              <div className="info-card" key={point.h}>
                <h3>{point.h}</h3>
                <p>{point.p}</p>
              </div>
            ))}
          </div>

          <div className="callout rise" style={{ ["--i" as string]: 15, marginTop: 20, maxWidth: "72ch" }}>
            <p className="callout-label">One limitation, stated rather than glossed over</p>
            <p>
              The backend has no authentication, so anyone who could reach it while a report is
              generating could, in principle, read that job&rsquo;s status. Nothing is retained
              afterward and each job is short-lived, so the exposure is narrow — but it is real.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
