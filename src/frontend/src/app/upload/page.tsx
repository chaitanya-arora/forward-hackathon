"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { startReport, type UploadEntry } from "@/lib/api";

interface Entry {
  file: File;
  sourceType: UploadEntry["sourceType"];
}

const CURRENT_YEAR = String(new Date().getFullYear());

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [reportYear, setReportYear] = useState(CURRENT_YEAR);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const pdfs = Array.from(list).filter((f) => f.type === "application/pdf");
    const rejected = list.length - pdfs.length;
    setError(
      rejected > 0
        ? `${rejected} file${rejected === 1 ? "" : "s"} skipped — only PDFs can be read.`
        : null,
    );
    setEntries((prev) => [...prev, ...pdfs.map((file) => ({ file, sourceType: "unknown" as const }))]);
  }

  async function submit() {
    if (entries.length === 0) return;
    if (!companyName.trim()) {
      setError("Enter the company name — the AASB S2 report is prepared for a specific entity.");
      return;
    }
    if (!/^\d{4}$/.test(reportYear)) {
      setError("Reporting year must be a four-digit year.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { companyId, runId } = await startReport(companyName.trim(), reportYear, entries);
      router.push(`/processing/${companyId}/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const totalMb = entries.reduce((n, e) => n + e.file.size, 0) / 1024 / 1024;

  return (
    <div className="surface-dark journey">
      <SiteHeader />

      <main className="page" style={{ paddingTop: 28 }}>
        <p className="eyebrow rise">Step one of two</p>
        <h1 className="display display-l rise" style={{ ["--i" as string]: 1 }}>
          Add the company&rsquo;s documents
        </h1>
        <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 16, marginBottom: 28 }}>
          Any mix of public disclosures and internal material, for one company and one reporting year.
        </p>

        <div className="rise" style={{ ["--i" as string]: 2, display: "flex", gap: 12, marginBottom: 26, flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 260px" }}>
            <label className="note" style={{ display: "block", marginBottom: 6 }}>
              Company name
            </label>
            <input
              className="input"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Quality Holdings Resources"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label className="note" style={{ display: "block", marginBottom: 6 }}>
              Reporting year
            </label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              placeholder={CURRENT_YEAR}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div
          className={`dropzone rise${dragging ? " is-dragging" : ""}`}
          style={{ ["--i" as string]: 3 }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <p className="dropzone-title">
            {dragging ? (
              <b>Drop to add</b>
            ) : (
              <>
                Drop PDFs here, or <b>browse</b>
              </>
            )}
          </p>
          <p className="note" style={{ margin: 0 }}>
            Up to 20 documents, up to 25&nbsp;MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {entries.length > 0 && (
          <div style={{ marginTop: 26, display: "grid", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <h2 className="eyebrow" style={{ margin: 0 }}>
                {entries.length} document{entries.length === 1 ? "" : "s"} ready
              </h2>
              <span className="note">{totalMb.toFixed(1)} MB total</span>
            </div>

            {entries.map((entry, i) => (
              <div className="filerow fade" key={`${entry.file.name}-${i}`}>
                <div className="filerow-icon">PDF</div>

                <div style={{ minWidth: 0 }}>
                  <div className="filerow-name">{entry.file.name}</div>
                  <div className="note" style={{ fontSize: 12 }}>
                    {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>

                <select
                  className="input"
                  value={entry.sourceType}
                  aria-label={`Visibility of ${entry.file.name}`}
                  onChange={(e) =>
                    setEntries((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, sourceType: e.target.value as Entry["sourceType"] } : x,
                      ),
                    )
                  }
                >
                  <option value="unknown">Visibility unknown</option>
                  <option value="public">Public disclosure</option>
                  <option value="internal">Internal document</option>
                </select>

                <button
                  className="iconbtn"
                  onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${entry.file.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 30,
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn-primary" onClick={submit} disabled={entries.length === 0 || busy}>
            {busy ? "Starting…" : "Generate AASB S2 report"}
          </button>
          <span className="note">
            {entries.length === 0
              ? "Add at least one document to begin."
              : "Gemini is rate-limited, so this can take a few minutes."}
          </span>
        </div>

        <section className="panel" style={{ marginTop: 48 }}>
          <h2 className="eyebrow" style={{ marginBottom: 16 }}>
            What helps most
          </h2>
          <div className="guide">
            <p className="guide-item">
              <span>
                <b>A sustainability or annual report</b> is the strongest single document — it
                usually carries governance, strategy and emissions evidence together.
              </span>
            </p>
            <p className="guide-item">
              <span>
                <b>Board and committee material</b> — charters, terms of reference, risk committee
                papers — is where governance evidence hides.
              </span>
            </p>
            <p className="guide-item">
              <span>
                <b>Anything with numbers in it</b> — emissions inventories, energy data packs, target
                commitments. Metrics &amp; Targets is the section most likely to come back thin.
              </span>
            </p>
            <p className="guide-item">
              <span>
                <b>Marking a document public or internal is optional</b> and helps trace evidence
                provenance during the AASB S2 review.
              </span>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
