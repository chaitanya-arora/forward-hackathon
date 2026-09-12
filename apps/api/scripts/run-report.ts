import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ExtractionResultSchema,
  PILLAR_KEYS,
  PILLAR_LABELS,
  ReportSchema,
} from "@climate/contract";
import { generateReport } from "../src/agent2/report.js";

/**
 * Agent 2 validation harness (plan §Verification). Runs against Agent 1's saved
 * real output and checks every citation resolves.
 *
 * usage: npm run report -w @climate/api -- [apps/api/.data/extraction.json]
 */
const input = process.argv[2] ?? path.resolve(process.cwd(), "apps/api/.data/extraction.json");
const extraction = ExtractionResultSchema.parse(JSON.parse(await readFile(input, "utf8")));

console.log(`Generating report from ${extraction.evidence.length} evidence items...\n`);
const started = Date.now();

const report = await generateReport(extraction, (detail) =>
  process.stdout.write(`\r${detail.padEnd(60)}`),
);

console.log(`\n\nElapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);

// The contract must hold — this is the same schema the frontend renders against.
ReportSchema.parse(report);
console.log("✓ Report validates against ReportSchema");

// Every citation must resolve to real evidence.
const validIds = new Set(report.evidence.map((e) => e.id));
const cited = [
  ...Object.values(report.pillars).flatMap((p) => p.evidence_ids),
  ...report.findings.flatMap((f) => f.evidence_ids),
];
const dangling = cited.filter((id) => !validIds.has(id));
console.log(
  dangling.length === 0
    ? `✓ All ${cited.length} citations resolve to real evidence`
    : `✗ ${dangling.length} dangling citations: ${dangling.join(", ")}`,
);

console.log(`\n${report.company_name} — ${report.overall_readiness_score}/100`);
console.log(`\n${report.executive_summary}\n`);

for (const key of PILLAR_KEYS) {
  const p = report.pillars[key]!;
  console.log(`── ${PILLAR_LABELS[key]}: ${p.score}/100 (${p.completeness}) — ${p.evidence_ids.length} citations`);
  console.log(`   ${p.narrative}\n`);
}

console.log(`Findings: ${report.findings.length}`);
for (const f of report.findings) console.log(`  [${f.type}] ${f.summary}`);
console.log(`\nRecommendations: ${report.recommendations.length}`);
for (const r of report.recommendations) console.log(`  (${PILLAR_LABELS[r.pillar]}) ${r.text}`);

const outFile = path.resolve(process.cwd(), "apps/api/.data/latest.json");
await writeFile(outFile, JSON.stringify(report, null, 2), "utf8");
console.log(`\nSaved to ${outFile}`);
