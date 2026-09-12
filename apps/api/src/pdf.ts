import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";

export interface PageText {
  page: number;
  text: string;
}

/**
 * PDF -> per-page text (spec §3.1). Using pdfjs-dist directly rather than
 * pdf-parse with a `pagerender` callback: pdf-parse wraps pdfjs anyway, and
 * going direct gives real page boundaries without the callback hack.
 */
export async function extractPages(data: Buffer): Promise<PageText[]> {
  const doc = await getDocument({
    data: new Uint8Array(data),
    // Keep the worker in-process; we're on a server, not in a browser.
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pages: PageText[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item as TextItem).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: n, text });
    page.cleanup();
  }

  await doc.destroy();
  return pages;
}

export interface Chunk {
  text: string;
  pages: number[];
  /** The page a claim should cite by default: the first page in the chunk. */
  startPage: number;
}

/**
 * Group pages into ~4000-char blocks, tracking which pages contributed
 * (spec §3.2). Pages are never split across chunks, so page attribution
 * stays exact.
 */
export function chunkPages(pages: PageText[], maxChars = 4000): Chunk[] {
  const chunks: Chunk[] = [];
  let current: PageText[] = [];
  let length = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      text: current.map((p) => `[page ${p.page}]\n${p.text}`).join("\n\n"),
      pages: current.map((p) => p.page),
      startPage: current[0]!.page,
    });
    current = [];
    length = 0;
  };

  for (const page of pages) {
    if (page.text.length === 0) continue;
    if (length > 0 && length + page.text.length > maxChars) flush();
    current.push(page);
    length += page.text.length;
  }
  flush();

  return chunks;
}
