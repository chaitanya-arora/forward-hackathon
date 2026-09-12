import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeEvidence } from "../normalizeEvidence.js";
import { rubric } from "../rubric.js";
import { buildReport, generateESGReport } from "../generateESGReport.js";

const quote = "The safety committee reviews incidents monthly.";
const input = { company: "Example", evidence: [{ claim: quote, sourceType: "internal", page: 3 }] };
const missing = () => ({ assessments: rubric.map((r) => ({ criterionId: r.id, status: "missing", citations: [], potentialInconsistency: false })) });
function classified(id = "social.safety") {
  const result = missing();
  Object.assign(result.assessments.find((r) => r.criterionId === id), { status: "strong", citations: [{ evidenceId: "e1", quote }] });
  return result;
}

test("normalizes Agent 1 and keeps pooled pages separate", () => {
  const data = normalizeEvidence({ company_name: "Example", report_year: "2025", pillars: {
    governance: { raw_text_chunks: [{ text: "[Page 5] Board oversight", confidence: 0.9 }], source_pages: [5, 6, 7] },
    strategy: { raw_text_chunks: [{ text: "Climate strategy" }], source_pages: [8, 9] },
  } });
  assert.deepEqual(data.evidence[0].pages, [5]);
  assert.deepEqual(data.evidence[1].pages, []);
  assert.deepEqual(data.evidence[1].pillarSourcePages, [8, 9]);
  assert.equal(data.evidence[0].sourceType, "unknown");
});

test("existing empty Agent 1 sample works offline", async () => {
  const sample = JSON.parse(await readFile(new URL("../../agent1/output/quality_holdings_resources_2025_classified.json", import.meta.url)));
  const report = await generateESGReport(sample, { client: { models: { generateContent() { throw Error("must not call"); } } } });
  assert.equal(report.overallESGScore, 0);
  assert.equal(report.aasbS2.readinessScore, 0);
  assert.equal(report.social.status, "missing");
  assert.equal(report.priorityActions.length, 13);
});

test("calculates scores, retains original evidence, flags disclosure gaps", () => {
  const report = buildReport(normalizeEvidence(input), classified());
  assert.equal(report.social.score, 33);
  assert.equal(report.overallESGScore, 11);
  assert.equal(report.aasbS2.readinessScore, 0);
  assert.equal(report.social.criteria[1].gapType, "disclosure_gap");
  assert.equal(report.social.evidence[0].text, quote);
});

test("unknown visibility does not become a disclosure gap", () => {
  const report = buildReport(normalizeEvidence({ company: "Example", evidence: [{ claim: quote }] }), classified());
  assert.equal(report.social.criteria[1].gapType, null);
});

test("unsupported strong assessments cannot score; low confidence is capped", () => {
  const data = missing();
  data.assessments[0].status = "strong";
  assert.equal(buildReport(normalizeEvidence(input), data).environmental.score, 0);
  const low = normalizeEvidence({ ...input, evidence: [{ ...input.evidence[0], confidence: 0.2 }] });
  assert.equal(buildReport(low, classified()).social.score, 17);
});

test("rejects hallucinated quotations, IDs, invalid statuses, omitted and duplicate criteria", () => {
  for (const mutate of [
    (r) => { r.assessments[4].citations[0].quote = "Entirely fabricated evidence claim"; },
    (r) => { r.assessments[4].citations[0].evidenceId = "fake"; },
    (r) => { r.assessments[0].status = "excellent"; },
    (r) => { r.assessments.pop(); },
    (r) => { r.assessments.push(r.assessments[0]); },
  ]) { const result = classified(); mutate(result); assert.throws(() => buildReport(normalizeEvidence(input), result)); }
});

test("public/internal inconsistencies are capped and prioritized", () => {
  const data = normalizeEvidence({ company: "Example", evidence: [
    { claim: quote, sourceType: "public" }, { claim: "The safety committee did not meet in FY2025.", sourceType: "internal" },
  ] });
  const result = classified();
  const item = result.assessments[4];
  item.potentialInconsistency = true;
  item.citations.push({ evidenceId: "e2", quote: data.evidence[1].text });
  const report = buildReport(data, result);
  assert.equal(report.social.criteria[1].status, "partial");
  assert.equal(report.social.criteria[1].gapType, "potential_inconsistency");
  assert.equal(report.priorityActions[0].criterionId, "social.safety");
});

test("validates malformed and oversized inputs", () => {
  for (const value of [null, {}, { company: "X" }, { company: "X", evidence: [{}] },
    { company: "X", pillars: { governance: {} } },
    { company: "X", evidence: [{ claim: quote, confidence: 2 }] },
    { company: "X", evidence: [{ claim: "a".repeat(200001) }] },
  ]) assert.throws(() => normalizeEvidence(value));
});

test("LLM request uses structured JSON and propagates failures", async () => {
  let request;
  const client = { models: { async generateContent(value) { request = value; return { text: JSON.stringify(classified()) }; } } };
  assert.equal((await generateESGReport(input, { client })).social.score, 33);
  assert.equal(request.config.responseMimeType, "application/json");
  assert.ok(request.config.responseJsonSchema);
  for (const text of ["not json", "{}", '{"assessments":[]}']) {
    await assert.rejects(generateESGReport(input, { client: { models: { async generateContent() { return { text }; } } } }));
  }
  await assert.rejects(generateESGReport(input, { client: { models: { async generateContent() { throw Error("API unavailable"); } } } }), /API unavailable/);
});
