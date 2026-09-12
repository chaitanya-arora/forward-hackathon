"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { startReport } from "@/lib/api";

interface Entry {
  file: File;
  label: string;
}

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
    setError(rejected > 0 ? `${rejected} non-PDF file(s) were ignored.` : null);
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

  return (
    <>
      <TopBar />
      <main className="page" style={{ paddingTop: 40, maxWidth: 760 }}>
        <p className="report-kicker">Step one</p>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, fontWeight: 600, margin: "0 0 10px" }}>
          Add the company&rsquo;s documents
        </h1>
        <p className="note" style={{ fontSize: 15, maxWidth: "56ch", marginBottom: 32 }}>
          Any mix of public disclosures and internal material. Labels are optional and appear in the
          report&rsquo;s citations so a reader can see where each piece of evidence came from.
        </p>

        <div
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
          style={{
            border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--rule-strong)"}`,
            background: dragging ? "var(--accent-soft)" : "var(--surface)",
            borderRadius: 8,
            padding: "44px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color .15s, background .15s",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 16 }}>
            Drop PDFs here, or <span style={{ color: "var(--accent)" }}>browse</span>
          </p>
          <p className="note" style={{ margin: 0 }}>Any number of documents, up to 50&nbsp;MB each</p>
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
          <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
            {entries.map((entry, i) => (
              <div
                key={`${entry.file.name}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.file.name}
                  </div>
                  <div className="note" style={{ fontSize: 12 }}>
                    {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>

                <input
                  type="text"
                  value={entry.label}
                  placeholder="Label (optional)"
                  onChange={(e) =>
                    setEntries((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  style={{
                    font: "inherit",
                    fontSize: 13.5,
                    padding: "7px 10px",
                    border: "1px solid var(--rule)",
                    borderRadius: 5,
                    background: "var(--paper)",
                    color: "var(--ink)",
                    minWidth: 0,
                  }}
                />

                <button
                  onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${entry.file.name}`}
                  style={{
                    border: 0,
                    background: "none",
                    color: "var(--ink-faint)",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="note" style={{ marginTop: 16, color: "var(--missing)" }}>
            {error}
          </p>
        )}

        <div style={{ marginTop: 32, display: "flex", gap: 12, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={entries.length === 0 || busy}
          >
            {busy ? "Starting…" : `Generate report${entries.length ? ` from ${entries.length}` : ""}`}
          </button>
          {entries.length > 0 && !busy && (
            <span className="note">
              Analysis typically takes under a minute per document.
            </span>
          )}
        </div>
      </main>
    </>
  );
}
