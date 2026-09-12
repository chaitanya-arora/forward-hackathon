const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const pages = (value) => Array.isArray(value)
  ? [...new Set(value.filter((p) => Number.isInteger(p) && p > 0))] : [];

// Agent 1 enters here. Do not import its CLI: importing it runs PDF extraction.
export function normalizeEvidence(input) {
  if (!object(input)) throw new TypeError("Evidence input must be an object.");
  const company = input.company_name ?? input.company;
  if (typeof company !== "string" || !company.trim()) throw new TypeError("A company name is required.");
  const evidence = [];
  const warnings = [];
  function add(item, context = {}) {
    if (!object(item)) throw new TypeError("Each evidence item must be an object.");
    const text = item.text ?? item.claim;
    if (typeof text !== "string" || !text.trim()) throw new TypeError("Each evidence item needs text or claim.");
    const confidence = item.confidence ?? null;
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      throw new TypeError("Confidence must be between 0 and 1.");
    }
    const markedPages = [...text.matchAll(/\[Page (\d+)\]/g)].map((m) => Number(m[1]));
    evidence.push({
      id: `e${evidence.length + 1}`, text: text.trim(), confidence,
      documentId: Number.isInteger(item.documentId) && item.documentId > 0 ? item.documentId : null,
      category: typeof item.category === "string" ? item.category : null,
      pillar: context.pillar ?? null,
      source: typeof item.source === "string" ? item.source : null,
      sourceType: ["public", "internal"].includes(item.sourceType) ? item.sourceType : "unknown",
      pages: pages(item.pages ?? (item.page != null ? [item.page] : markedPages)),
      // Agent 1 pools pages per pillar; these are NOT precise chunk citations.
      pillarSourcePages: pages(item.pillarSourcePages ?? context.sourcePages),
    });
  }
  if (input.pillars !== undefined) {
    if (!object(input.pillars)) throw new TypeError("pillars must be an object.");
    for (const [pillar, group] of Object.entries(input.pillars)) {
      if (!["governance", "strategy", "risk_management", "metrics_targets"].includes(pillar)) {
        throw new TypeError(`Unknown Agent 1 pillar: ${pillar}`);
      }
      if (!object(group) || !Array.isArray(group.raw_text_chunks)) throw new TypeError(`Invalid pillar: ${pillar}`);
      for (const item of group.raw_text_chunks) add(item, { pillar, sourcePages: group.source_pages });
    }
    warnings.push("Agent 1 filters for climate relevance; missing ESG evidence may reflect extraction coverage.");
  } else if (Array.isArray(input.evidence)) {
    for (const item of input.evidence) add(item);
  } else throw new TypeError("Expected Agent 1 pillars or an evidence array.");
  if (evidence.some((e) => e.sourceType === "unknown")) warnings.push("Source visibility is unknown for some evidence; public/internal comparisons are limited.");
  if (JSON.stringify(evidence).length > 200000) throw new RangeError("Evidence exceeds the MVP 200,000-character limit; split the input explicitly.");
  return { company: company.trim(), reportYear: input.report_year ?? null, evidence, warnings };
}
