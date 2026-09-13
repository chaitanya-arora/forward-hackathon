import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/** Mirrors the real report's shape so the hero is an honest preview, not decoration. */
const PREVIEW_PILLARS = [
  { name: "Governance", score: 87 },
  { name: "Strategy", score: 54 },
  { name: "Risk Management", score: 66 },
  { name: "Metrics & Targets", score: 38 },
];

const STEPS = [
  {
    h: "Upload what you already have",
    p: "Annual reports, board policies, internal memos — any mix, in any order. There is nothing to fill in and no questionnaire to work through.",
  },
  {
    h: "Every document strengthens the assessment",
    p: "Evidence is pooled across everything you provide. More material means a more complete report.",
  },
  {
    h: "Nothing in the report is unsourced",
    p: "Each pillar cites the exact claims behind it, with document name and page number, so anyone reading it can check the work against your own files.",
  },
];

export default function LandingPage() {
  return (
    <div className="surface-dark journey">
      <SiteHeader>
        <Link href="/upload" className="btn btn-primary">
          Generate a report
        </Link>
      </SiteHeader>

      <main className="page page-wide" style={{ paddingBottom: 32 }}>
        <div className="hero">
          <div>
            <p className="eyebrow rise" style={{ ["--i" as string]: 0 }}>
              Your documents in · Official report out
            </p>
            <h1 className="display display-xl rise" style={{ ["--i" as string]: 1 }}>
              <span className="title-dim">Your Company,</span> GreenScreened
            </h1>
            <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 22 }}>
              Most companies without a sustainability team already hold the evidence an AASB S2 or
              TCFD assessment needs. It is just scattered across files nobody has read together.
              GreenScreened reads whatever you have and returns a cited report — every claim traced to
              the document and page it came from.
            </p>
            <div className="hero-actions rise" style={{ ["--i" as string]: 3 }}>
              <Link href="/upload" className="btn btn-primary">
                Generate a report
              </Link>
              <Link href="/about" className="btn">
                About
              </Link>
              <Link href="/report/preview" className="btn">
                See an example
              </Link>
            </div>
          </div>

          <div className="fade" style={{ ["--i" as string]: 4 }}>
            <div className="proof" aria-hidden="true">
              <p className="proof-kicker">Climate disclosure readiness · AASB S2 / TCFD</p>
              <p className="proof-company">Quality Holdings Resources</p>
              <p className="proof-meta">Prepared from 2 documents provided by the company</p>

              <div className="proof-score">
                <b>61</b>
                <span>Overall readiness</span>
              </div>

              {PREVIEW_PILLARS.map((p) => (
                <div className="proof-row" key={p.name}>
                  <em>{p.name}</em>
                  <b>{p.score}</b>
                  <div className="proof-bar">
                    <i style={{ width: `${p.score}%` }} />
                  </div>
                </div>
              ))}

              <p className="proof-cite">
                <code>ev_001</code> quality_holdings.pdf · page 12 — “The Board Risk and
                Sustainability Committee meets quarterly…”
              </p>
            </div>
          </div>
        </div>

        <div className="strip">
          {STEPS.map((s, i) => (
            <div key={s.h} className="rise" style={{ ["--i" as string]: 5 + i }}>
              <span className="strip-num">{String(i + 1).padStart(2, "0")}</span>
              <h2>{s.h}</h2>
              <p className="strip-body">{s.p}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
