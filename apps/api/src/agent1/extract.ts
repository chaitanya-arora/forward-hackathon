import { z } from "zod";
import {
  PillarKeySchema,
  type Evidence,
  type ExtractionResult,
  type SourceDocument,
} from "@climate/contract";
import { callModel, mapWithConcurrency, MODELS } from "../llm.js";
import { chunkPages, extractPages } from "../pdf.js";
import { EXTRACTION_SYSTEM_PROMPT } from "../pillars.js";

/** What the model returns per chunk. IDs are assigned by us afterwards, never by the model. */
const RawClaimSchema = z.object({
  pillar: z.union([PillarKeySchema, z.literal("not_relevant")]),
  claim: z.string(),
  raw_text_snippet: z.string(),
  page: z.number().int(),
  confidence: z.number().min(0).max(1),
});

const ChunkResultSchema = z.object({
  items: z.array(RawClaimSchema),
});

const MIN_CONFIDENCE = 0.5;
const CHUNK_CONCURRENCY = 5;

export interface UploadedDocument {
  filename: string;
  label: string;
  buffer: Buffer;
}

export interface ExtractionStats {
  chunks: number;
  returned: number;
  droppedNotRelevant: number;
  droppedLowConfidence: number;
}

export interface ExtractionOutcome extends ExtractionResult {
  stats: ExtractionStats;
}

export async function runExtraction(
  documents: UploadedDocument[],
  onProgress?: (detail: string) => void,
): Promise<ExtractionOutcome> {
  const sources: SourceDocument[] = documents.map((d) => ({
    filename: d.filename,
    label: d.label,
  }));

  // Read every document into page-tagged chunks first, so the progress count is real.
  const allChunks: Array<{ document: string; text: string; pages: number[] }> = [];
  for (const doc of documents) {
    onProgress?.(`Reading ${doc.filename}`);
    const pages = await extractPages(doc.buffer);
    for (const chunk of chunkPages(pages)) {
      allChunks.push({ document: doc.filename, text: chunk.text, pages: chunk.pages });
    }
  }

  const stats: ExtractionStats = {
    chunks: allChunks.length,
    returned: 0,
    droppedNotRelevant: 0,
    droppedLowConfidence: 0,
  };

  let completed = 0;
  const perChunk = await mapWithConcurrency(allChunks, CHUNK_CONCURRENCY, async (chunk) => {
    const result = await callModel({
      system: EXTRACTION_SYSTEM_PROMPT,
      user: chunk.text,
      schema: ChunkResultSchema,
      model: MODELS.extraction,
      effort: "low",
    });
    completed++;
    onProgress?.(`Analysed ${completed} of ${allChunks.length} sections`);
    return { chunk, items: result.items };
  });

  // Pool everything, then filter. Documents are processed identically — `label`
  // is carried through for citation display only and drives no logic (spec §3.4).
  const evidence: Evidence[] = [];

  for (const { chunk, items } of perChunk) {
    for (const item of items) {
      stats.returned++;

      if (item.pillar === "not_relevant") {
        stats.droppedNotRelevant++;
        continue;
      }
      if (item.confidence < MIN_CONFIDENCE) {
        stats.droppedLowConfidence++;
        continue;
      }

      // Clamp a hallucinated page number back into the chunk's real range.
      const page = chunk.pages.includes(item.page) ? item.page : chunk.pages[0]!;

      evidence.push({
        id: "", // assigned below
        pillar: item.pillar,
        claim: item.claim,
        document: chunk.document,
        page,
        confidence: item.confidence,
        raw_text_snippet: item.raw_text_snippet.slice(0, 300),
      });
    }
  }

  evidence.sort((a, b) =>
    a.document === b.document ? a.page - b.page : a.document.localeCompare(b.document),
  );
  evidence.forEach((e, i) => {
    e.id = `ev_${String(i + 1).padStart(3, "0")}`;
  });

  return {
    company_name: await inferCompanyName(documents, evidence),
    documents: sources,
    evidence,
    stats,
  };
}

const CompanyNameSchema = z.object({
  company_name: z.string(),
});

async function inferCompanyName(
  documents: UploadedDocument[],
  evidence: Evidence[],
): Promise<string> {
  const sample = evidence
    .slice(0, 12)
    .map((e) => e.raw_text_snippet)
    .join("\n");

  if (sample.trim().length === 0) {
    return documents[0]?.filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") ?? "Unknown company";
  }

  try {
    const result = await callModel({
      system:
        "Identify the company that authored the document these excerpts came from. " +
        "Return the company's proper name only. If it is genuinely unclear, return \"Unknown company\".",
      user: `Filenames: ${documents.map((d) => d.filename).join(", ")}\n\nExcerpts:\n${sample}`,
      schema: CompanyNameSchema,
      effort: "low",
      maxTokens: 1000,
    });
    return result.company_name;
  } catch {
    return documents[0]?.filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") ?? "Unknown company";
  }
}
