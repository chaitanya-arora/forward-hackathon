import { readFile } from "node:fs/promises";
import path from "node:path";
import { ReportSchema } from "@climate/contract";

/**
 * Validates any report JSON against the contract and checks that every
 * citation resolves. Run against the mock the frontend is built on, and
 * against real pipeline output.
 *
 * usage: npm run validate -w @climate/api -- <report.json>
 */
const file = process.argv[2] ?? path.resolve(process.cwd(), "apps/web/mock/report.json");
const report = ReportSchema.parse(JSON.parse(await readFile(file, "utf8")));

console.log(
  `✓ validates against ReportSchema — ${report.company_name}, ` +
    `${report.evidence.length} evidence, ${report.findings.length} findings, ` +
    `${report.recommendations.length} recommendations`,
);

const ids = new Set(report.evidence.map((e) => e.id));
const cited = [
  ...Object.values(report.pillars).flatMap((p) => p?.evidence_ids ?? []),
  ...report.findings.flatMap((f) => f.evidence_ids),
];
const dangling = cited.filter((id) => !ids.has(id));

if (dangling.length > 0) {
  console.error(`✗ ${dangling.length} dangling citations: ${[...new Set(dangling)].join(", ")}`);
  process.exit(1);
}
console.log(`✓ all ${cited.length} citations resolve to real evidence`);
