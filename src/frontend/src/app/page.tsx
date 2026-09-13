import Link from "next/link";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/** Mirrors the real report's shape (a readiness score plus key findings) so
 * the hero is an honest preview, not decoration. */
const PREVIEW_FINDINGS = [
  {
    importance: "high" as const,
    title: "Metrics & targets: disclosure evidence gaps",
    summary: "Emissions and target information is missing or incomplete across several disclosure criteria.",
  },
  {
    importance: "medium" as const,
    title: "Governance contains supported disclosures",
    summary: "Board oversight and reporting responsibilities are clearly evidenced across the supplied documents.",
  },
];

const STEPS = [
  {
    h: "Upload what you already have",
    p: "Annual reports, board policies, internal memos — any mix, in any order. Provide the company and reporting year, then select your PDF documents.",
  },
  {
    h: "Bring the relevant evidence together",
    p: "Evidence is pooled across everything you provide. Relevant material can address gaps; completeness still depends on what it supports.",
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
              Your documents in · AASB S2 readiness out
            </p>
            <h1 className="display display-xl rise" style={{ ["--i" as string]: 1 }}>
              <span className="title-dim">Your Company,</span> GreenScreened
            </h1>
            <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 22 }}>
              Company documents can hold evidence relevant to an AASB S2 readiness assessment. It is just scattered across files nobody has read together.
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
              <p className="proof-kicker">Climate disclosure readiness · AASB S2</p>
              <p className="proof-company">Quality Holdings Resources</p>
              <p className="proof-meta">Prepared from 2 documents provided by the company</p>

              <div className="proof-score">
                <div className="proof-score-ring">
                  <b>61</b>
                  <small>/100</small>
                </div>
                <span>Readiness</span>
              </div>

              {PREVIEW_FINDINGS.map((f) => (
                <div className={`proof-finding proof-finding--${f.importance}`} key={f.title}>
                  <span className="proof-finding-icon">
                    {f.importance === "high" ? <AlertTriangleIcon /> : <CheckCircleIcon />}
                  </span>
                  <div>
                    <b>{f.title}</b>
                    <p>{f.summary}</p>
                  </div>
                </div>
              ))}

              <p className="proof-footer">6 key findings · 12 priority actions identified</p>
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
