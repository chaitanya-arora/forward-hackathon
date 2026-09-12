import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PILLAR_KEYS, PILLAR_LABELS } from "@climate/contract";
import { runExtraction, type UploadedDocument } from "../src/agent1/extract.js";

/**
 * Agent 1 validation harness (plan §Verification). Runs extraction alone and
 * prints the sanity numbers: evidence per pillar, mean confidence, drop counts.
 *
 * usage: npm run extract -w @climate/api -- <file.pdf> [label] [more.pdf] [label] ...
 */
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: npm run extract -w @climate/api -- <file.pdf> [label] ...");
  process.exit(1);
}

const documents: UploadedDocument[] = [];
for (let i = 0; i < args.length; i++) {
  const file = args[i]!;
  if (!file.toLowerCase().endsWith(".pdf")) continue;
  const next = args[i + 1];
  const label = next && !next.toLowerCase().endsWith(".pdf") ? next : "Company-provided document";
  documents.push({
    filename: path.basename(file),
    label,
    buffer: await readFile(file),
  });
}

console.log(`Extracting from ${documents.length} document(s)...\n`);
const started = Date.now();

const result = await runExtraction(documents, (p) =>
  process.stdout.write(`\r${p.detail.padEnd(44)}${p.evidenceFound} kept`.padEnd(60)),
);

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n\nCompany: ${result.company_name}`);
console.log(`Elapsed: ${elapsed}s`);
console.log(`Chunks: ${result.stats.chunks}`);
console.log(
  `Model returned ${result.stats.returned} candidates; dropped ` +
    `${result.stats.droppedNotRelevant} not-relevant, ${result.stats.droppedLowConfidence} below confidence 0.5`,
);
console.log(`Kept: ${result.evidence.length} evidence items\n`);

for (const key of PILLAR_KEYS) {
  const items = result.evidence.filter((e) => e.pillar === key);
  const mean = items.length
    ? (items.reduce((s, e) => s + e.confidence, 0) / items.length).toFixed(2)
    : "—";
  console.log(`${PILLAR_LABELS[key].padEnd(18)} ${String(items.length).padStart(3)} items   mean confidence ${mean}`);
}

const outDir = path.resolve(process.cwd(), "apps/api/.data");
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "extraction.json");
await writeFile(outFile, JSON.stringify(result, null, 2), "utf8");
console.log(`\nSaved to ${outFile}`);
