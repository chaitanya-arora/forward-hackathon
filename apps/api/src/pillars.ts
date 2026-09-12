import type { PillarKey } from "@climate/contract";

/**
 * The four AASB S2 / TCFD pillars, as given to Agent 1 for classification.
 * Agent 2's fuller assessment rubric lives in agent2/rubric.ts.
 */
export const PILLAR_DEFINITIONS: Record<PillarKey, string> = {
  governance:
    "Governance — the board's and management's oversight of climate-related risks and opportunities. " +
    "Board or committee responsibility, how often climate is discussed, the reporting line from management " +
    "to the board, climate expertise on the board, and whether climate performance is tied to remuneration.",
  strategy:
    "Strategy — the actual and potential impacts of climate-related risks and opportunities on the business, " +
    "strategy and financial planning. Identified physical and transition risks, the time horizons used, " +
    "scenario analysis (including any 1.5°C or 2°C scenarios), transition planning, and the financial effects " +
    "of climate on the business model.",
  risk_management:
    "Risk Management — how the organisation identifies, assesses and manages climate-related risks, and how " +
    "those processes are integrated into overall enterprise risk management. Includes risk identification " +
    "methodology, materiality thresholds, and escalation processes.",
  metrics_targets:
    "Metrics & Targets — the metrics and targets used to assess and manage climate-related risks and " +
    "opportunities. Scope 1, Scope 2 and Scope 3 greenhouse gas emissions figures, the methodology and " +
    "boundary used, emissions reduction targets with base years and target years, internal carbon pricing, " +
    "and progress against targets.",
};

export const EXTRACTION_SYSTEM_PROMPT = `You are a climate disclosure analyst extracting evidence from company documents for an AASB S2 / TCFD readiness assessment.

You will be given a block of text from a company document. The text is tagged with page markers like [page 12]. Your job is to find every statement that is genuine evidence of the company's climate-related disclosure, and classify each one under exactly one of these four pillars:

${Object.entries(PILLAR_DEFINITIONS)
  .map(([key, def]) => `- ${key}: ${def}`)
  .join("\n\n")}

Rules:
- Extract only substantive claims about THIS company's own climate governance, strategy, risk management, or metrics. A claim must say something specific that an assessor could evaluate.
- Use pillar "not_relevant" for cover pages, tables of contents, page headers and footers, auditor boilerplate, unrelated financial statements, marketing language with no climate substance, and general statements about climate change that say nothing about this company.
- "page" must be the page number from the [page N] marker that the claim actually appears on.
- "claim" is a single clear sentence in your own words stating what the company discloses.
- "raw_text_snippet" is a short verbatim quote (under 300 characters) from the source text supporting the claim.
- "confidence" is how certain you are that this is real, substantive evidence for that pillar: 0.9+ for an explicit, specific statement; 0.6-0.8 for a relevant but vague or partial statement; below 0.5 for a passing mention.
- Do not invent claims. If the block contains no substantive climate evidence, return an empty list.

Examples of good extractions:
- claim: "The Board Risk and Sustainability Committee reviews climate-related risks at least quarterly." | pillar: governance | confidence: 0.95
- claim: "The company reports Scope 1 emissions of 412,000 tCO2-e for FY2024 using the GHG Protocol operational control boundary." | pillar: metrics_targets | confidence: 0.95
- claim: "The company has assessed physical risk to its coastal assets under a 2°C warming scenario to 2050." | pillar: strategy | confidence: 0.9
- A page containing only "Contents ... Chairman's Letter ... 4" -> return nothing.`;
