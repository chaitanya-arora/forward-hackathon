/**
 * Agent 1: Company Data Extraction — TCFD/AASB S2 Pillar Classification
 *
 * Pipeline:
 *   1. Extract text per page from a PDF (keeps page numbers for source citations)
 *   2. Chunk pages into ~800-1200 token blocks
 *   3. Classify each chunk against the 4 TCFD pillars (or "not_relevant") via LLM
 *   4. Aggregate into the agreed JSON schema for Agent 2
 *
 * Requires:
 *   npm install pdfjs-dist @google/genai dotenv
 *
 * package.json needs: "type": "module"
 *
 * Set your API key in a .env file (same folder):
 *   GEMINI_API_KEY=your_key_here
 *   (get one free at https://aistudio.google.com/apikey)
 *
 * Run:
 *   node agent1.js <pdf_path> "<company_name>" <report_year>
 */

import "dotenv/config";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
// Use the legacy build — the standard build assumes a browser environment
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { saveClassification } from "./db.js"; // Make sure to put this in agent 2

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-2.0-flash"; // fast + cheap + generous free tier

// Free tier is ~15 requests/minute for Flash -> space calls out proactively
// rather than hitting 429s and relying on retries. Tune down on a paid tier.
const MIN_MS_BETWEEN_CALLS = 4500;
let lastCallTime = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// 1. PDF -> paged text
// ---------------------------------------------------------------------------

async function extractPages(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    if (text.trim()) {
      pages.push({ page: i, text });
    }
  }
  return pages;
}

// ---------------------------------------------------------------------------
// 2. Chunking — group pages into ~1000-token blocks, preserving page ranges
// ---------------------------------------------------------------------------

function chunkPages(pages, targetChars = 4000) {
  const chunks = [];
  let bufText = "";
  let bufPages = [];

  for (const p of pages) {
    bufText += `\n\n[Page ${p.page}]\n${p.text}`;
    bufPages.push(p.page);
    if (bufText.length >= targetChars) {
      chunks.push({ text: bufText.trim(), pages: [...bufPages] });
      bufText = "";
      bufPages = [];
    }
  }

  if (bufText.trim()) {
    chunks.push({ text: bufText.trim(), pages: bufPages });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// 3. Classification prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert classifier for climate-related financial
disclosures under the TCFD framework / AASB S2 Australian standard. You will be
given a chunk of text extracted from a company's annual or sustainability report.

Classify the chunk against these 4 pillars:

1. governance — board/management oversight of climate risks and opportunities:
   who oversees it, how often, board skills/committees, executive remuneration
   links to climate metrics.

2. strategy — material climate-related risks and opportunities, their actual
   or anticipated financial effects, climate scenario analysis, transition
   plans, resilience of the business strategy.

3. risk_management — the PROCESS for identifying, assessing, and managing
   climate risks (not the risks themselves) — how it integrates into the
   entity's overall risk management framework.

4. metrics_targets — quantitative data: Scope 1/2/3 GHG emissions, financed
   emissions (for financial institutions), other climate metrics, targets and
   progress against them.

If the chunk does not meaningfully relate to any pillar (e.g. it's a cover
page, table of contents, unrelated financial statements, generic company
history), classify it as "not_relevant".

A chunk can touch on more than one pillar — return the SINGLE most dominant
pillar. Do not force a classification if the content is genuinely generic.

Respond with ONLY valid JSON, no other text, in this exact shape:
{
  "pillar": "governance" | "strategy" | "risk_management" | "metrics_targets" | "not_relevant",
  "confidence": <float 0.0-1.0>,
  "justification": "<one sentence explaining why>"
}`;

// Gemini uses "user" / "model" roles (not "assistant") for chat history
const FEW_SHOT_EXAMPLES = [
  {
    role: "user",
    parts: [
      {
        text: "The Board's Sustainability Committee meets four times a year and reviews management's recommendations on climate-related risks and opportunities. Executive remuneration includes a 15% climate metrics component in the annual scorecard.",
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        text: JSON.stringify({
          pillar: "governance",
          confidence: 0.95,
          justification:
            "Describes board committee oversight structure and executive remuneration links to climate metrics.",
        }),
      },
    ],
  },
  {
    role: "user",
    parts: [
      {
        text: "Net equity Scope 1 and 2 GHG emissions were 4.2 MtCO2e in 2025, a reduction of 8% against the 2020 baseline. The company remains on track to meet its 2030 target of a 30% reduction.",
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        text: JSON.stringify({
          pillar: "metrics_targets",
          confidence: 0.98,
          justification:
            "Reports specific emissions figures and progress against a quantitative reduction target.",
        }),
      },
    ],
  },
];

async function waitForRateLimit() {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_MS_BETWEEN_CALLS) {
    await sleep(MIN_MS_BETWEEN_CALLS - elapsed);
  }
  lastCallTime = Date.now();
}

async function classifyChunk(chunkText, retries = 3) {
  const contents = [
    ...FEW_SHOT_EXAMPLES,
    { role: "user", parts: [{ text: chunkText }] },
  ];

  for (let attempt = 0; attempt < retries; attempt++) {
    await waitForRateLimit();
    let raw = "";
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json", // forces valid JSON output
          maxOutputTokens: 300,
          temperature: 0.1, // low temp — classification, not creative writing
        },
      });
      raw = response.text.trim();
      return JSON.parse(raw);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return {
          pillar: "not_relevant",
          confidence: 0.0,
          justification: `Failed to parse model output: ${raw.slice(0, 200)}`,
        };
      }
      // Free-tier rate limits are common — back off and retry
      if (attempt < retries - 1) {
        const wait = 2 ** attempt * 1000;
        console.log(`    (retrying after error: ${e.message}, waiting ${wait / 1000}s)`);
        await sleep(wait);
      } else {
        return {
          pillar: "not_relevant",
          confidence: 0.0,
          justification: `API call failed after ${retries} attempts: ${e.message}`,
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Aggregate into the Agent 1 -> Agent 2 schema
// ---------------------------------------------------------------------------

function buildOutputSchema(companyName, reportYear, chunks, classifications) {
  const pillars = {
    governance: { raw_text_chunks: [], source_pages: [] },
    strategy: { raw_text_chunks: [], source_pages: [] },
    risk_management: { raw_text_chunks: [], source_pages: [] },
    metrics_targets: { raw_text_chunks: [], source_pages: [] },
  };

  chunks.forEach((chunk, idx) => {
    const result = classifications[idx];
    const pillar = result?.pillar;
    if (pillars[pillar] && (result.confidence ?? 0) >= 0.5) {
      pillars[pillar].raw_text_chunks.push({
        text: chunk.text,
        confidence: result.confidence,
        justification: result.justification,
      });
      pillars[pillar].source_pages.push(...chunk.pages);
    }
  });

  for (const key of Object.keys(pillars)) {
    pillars[key].source_pages = [...new Set(pillars[key].source_pages)].sort(
      (a, b) => a - b
    );
  }

  return { company_name: companyName, report_year: reportYear, pillars };
}

// ---------------------------------------------------------------------------
// 5. Run end-to-end
// ---------------------------------------------------------------------------

async function run(pdfPath, companyName, reportYear, outPath) {
  console.log(`Extracting pages from ${pdfPath}...`);
  const pages = await extractPages(pdfPath);
  console.log(`  ${pages.length} pages with text`);

  const chunks = chunkPages(pages);
  console.log(`Classifying ${chunks.length} chunks...`);

  const classifications = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const result = await classifyChunk(c.text);
    classifications.push(result);
    console.log(
      `  [${i + 1}/${chunks.length}] pages ${c.pages[0]}-${c.pages[c.pages.length - 1]} -> ${result.pillar} (${result.confidence.toFixed(2)})`
    );
  }

  const output = buildOutputSchema(companyName, reportYear, chunks, classifications);
  
  saveClassification(companyName, reportYear, output.pillars); // Saving it to the database

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone. Wrote structured output to ${outPath}`);
  for (const [pillar, data] of Object.entries(output.pillars)) {
    console.log(
      `  ${pillar}: ${data.raw_text_chunks.length} chunks, pages ${JSON.stringify(data.source_pages)}`
    );
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length !== 3) {
  console.log('Usage: node agent1.js <pdf_path> "<company_name>" <report_year>');
  process.exit(1);
}

const [pdfPath, companyName, reportYear] = args;
const outPath = `${companyName.toLowerCase().replace(/\s+/g, "_")}_${reportYear}_classified.json`;

run(pdfPath, companyName, reportYear, outPath).catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});