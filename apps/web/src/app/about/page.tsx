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

const COMPLETENESS_ROWS = [
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
          <h1 className="display display-l rise" style={{ ["--i" as string]: 1 }}>
            How the report is built, and what happens to your documents
          </h1>
          <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 18 }}>
            Two plain explanations, not a legal notice and not a black box: how a score gets to the
            number it lands on, and what actually happens to a file between the moment you drop it in
            and the moment the report comes back.
          </p>
        </div>

        {/* --- how scores are calculated ----------------------------------- */}
        <section style={{ marginTop: 64 }}>
          <span className="strip-num rise" style={{ ["--i" as string]: 3 }}>
            01
          </span>
          <h2
            className="display display-l rise"
            style={{ ["--i" as string]: 4, fontSize: 28, marginBottom: 12 }}
          >
            How scores are calculated
          </h2>
          <p className="lede rise" style={{ ["--i" as string]: 5, marginBottom: 30 }}>
            Every report is assessed against four pillars, drawn directly from the AASB S2 / TCFD
            disclosure framework.
          </p>

          <div className="pillar-grid rise" style={{ ["--i" as string]: 6 }}>
            {PILLAR_KEYS.map((key) => (
              <div className="pillar-method" key={key}>
                <h3>{PILLAR_LABELS[key]}</h3>
                <p>{PILLAR_SUMMARIES[key]}</p>
              </div>
            ))}
          </div>

          <div className="panel rise" style={{ ["--i" as string]: 7, marginTop: 28 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>What the completeness ratings mean</h3>
            <div className="guide">
              {COMPLETENESS_ROWS.map((row) => (
                <p className="guide-item" key={row.label}>
                  <span>
                    <b className={`inline-badge inline-badge-${row.tone}`}>{row.label}</b> —{" "}
                    {row.body}
                  </span>
                </p>
              ))}
            </div>
          </div>

          <div className="panel rise" style={{ ["--i" as string]: 8, marginTop: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>From rating to number</h3>
            <div className="guide">
              <p className="guide-item">
                <span>
                  <b>The completeness rating sets the starting point.</b> Well-substantiated starts
                  well ahead of Partial, which starts well ahead of Missing.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>More corroborating evidence moves it up, with fast diminishing returns</b> — a
                  second citation matters far more than a ninth.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>How confident the model was in each piece of evidence</b> nudges the score up or
                  down slightly around that base.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>The overall score is the plain average of the four pillar scores</b> — no pillar
                  is weighted above another.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>The calculation is deterministic.</b> Nothing here is asked of the model — the
                  same evidence always produces the same score, which is why adding a second document
                  and re-running moves the number for a reason you can point to.
                </span>
              </p>
            </div>
          </div>

          <p className="note" style={{ marginTop: 20, maxWidth: "62ch" }}>
            One limitation worth stating plainly: a Missing rating means no supporting evidence was
            found in the documents provided — it is not proof that the underlying practice does not
            exist, only that it was not disclosed anywhere we could read it.
          </p>
        </section>

        {/* --- privacy & data ------------------------------------------------ */}
        <section style={{ marginTop: 72, paddingBottom: 40 }}>
          <span className="strip-num rise" style={{ ["--i" as string]: 9 }}>
            02
          </span>
          <h2
            className="display display-l rise"
            style={{ ["--i" as string]: 10, fontSize: 28, marginBottom: 12 }}
          >
            Privacy &amp; your documents
          </h2>
          <p className="lede rise" style={{ ["--i" as string]: 11, marginBottom: 30 }}>
            What actually happens between an upload and a report, stated plainly rather than left
            implicit.
          </p>

          <div className="panel rise" style={{ ["--i" as string]: 12 }}>
            <div className="guide">
              <p className="guide-item">
                <span>
                  <b>Nothing is stored.</b> A file is held in memory only while it is being read, and
                  discarded once evidence has been pulled from it — it is never written to disk.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>The report lives only in your browser tab.</b> There is no database, no history
                  and no account. Reload the page or close the tab and it is gone — download it first
                  if you want to keep it.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>Document text is sent to Anthropic&rsquo;s Claude API</b> to be read, classified
                  against the four pillars, and turned into the written assessment. That is the
                  material fact about how this works: your content leaves this application to be
                  processed by a third-party model.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>While a report is generating</b>, its progress sits in the server&rsquo;s memory
                  under a temporary job id so your browser can poll for it. This holds at most the 20
                  most recent jobs across every visitor, oldest evicted first, and all of it is lost on
                  a server restart — it exists to make the upload-and-poll flow work, not to keep
                  anything.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>No sign-in, no analytics, no cookies.</b> Nothing about you or your visit is
                  recorded beyond the ordinary logs any running server produces.
                </span>
              </p>
              <p className="guide-item">
                <span>
                  <b>One limitation, stated rather than glossed over:</b> the backend has no
                  authentication, so anyone who could reach it while a report is generating could, in
                  principle, read that job&rsquo;s status. Nothing is retained afterward and each job
                  is short-lived, so the exposure is narrow — but it is real.
                </span>
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
