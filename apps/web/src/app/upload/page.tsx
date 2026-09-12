"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { startReport } from "@/lib/api";

interface Entry {
  file: File;
  label: string;
}

/** Shown as placeholder rotation so the label field explains itself by example. */
const LABEL_EXAMPLES = [
  "2025 Sustainability Report",
  "Board climate policy",
  "FY25 Annual Report",
  "Risk committee charter",
  "Emissions data pack",
];

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
    setEntries((prev) => [...prev, ...pdfs.map((file) => ({ file, label: "" }))]);
  }

  async function submit() {
    if (entries.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { jobId } = await startReport(entries);
      router.push(`/processing/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const totalMb = entries.reduce((n, e) => n + e.file.size, 0) / 1024 / 1024;

  return (
    <div className="surface-dark journey">
      <TopBar>
        <a href="/report" className="btn btn-ghost">
          Latest report
        </a>
      </TopBar>

      <main className="page" style={{ paddingTop: 28 }}>
        <p className="eyebrow rise">Step one of two</p>
        <h1 className="display display-l rise" style={{ ["--i" as string]: 1 }}>
          Add the company&rsquo;s documents
        </h1>
        <p className="lede rise" style={{ ["--i" as string]: 2, marginTop: 16, marginBottom: 32 }}>
          Any mix of public disclosures and internal material. Nothing is stored — the files are read
          for evidence and then discarded.
        </p>

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
            Any number of documents, up to 50&nbsp;MB each
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

                <input
                  className="input"
                  type="text"
                  value={entry.label}
                  placeholder={LABEL_EXAMPLES[i % LABEL_EXAMPLES.length]}
                  aria-label={`Label for ${entry.file.name}`}
                  onChange={(e) =>
                    setEntries((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />

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
            {busy ? "Starting…" : "Generate report"}
          </button>
          <span className="note">
            {entries.length === 0
              ? "Add at least one document to begin."
              : "Roughly a minute per document."}
          </span>
        </div>

        {/* Guidance that used to be missing — fills the dead space with the
            question every first-time user actually has. */}
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
                papers — is where governance evidence hides. It is the pillar most often already
                satisfied without anyone realising.
              </span>
            </p>
            <p className="guide-item">
              <span>
                <b>Anything with numbers in it</b> — emissions inventories, energy data packs, target
                commitments. Metrics &amp; Targets is the pillar most likely to come back thin.
              </span>
            </p>
            <p className="guide-item">
              <span>
                <b>Labels are optional.</b> They appear beside citations in the finished report, so a
                reader can tell a public disclosure from an internal document at a glance.
              </span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
