import { z } from "zod";
import {
  CompletenessSchema,
  PILLAR_KEYS,
  PILLAR_LABELS,
  type Evidence,
  type ExtractionResult,
  type Finding,
  type PillarAssessment,
  type PillarKey,
  type Recommendation,
  type Report,
} from "@climate/contract";
import { callModel, MODELS } from "../llm.js";
import { PILLAR_DEFINITIONS } from "../pillars.js";
import { PILLAR_RUBRIC } from "./rubric.js";
import { overallScore, scorePillar } from "./score.js";

const PillarAssessmentDraftSchema = z.object({
  completeness: CompletenessSchema,
  narrative: z.string(),
  evidence_ids: z.array(z.string()),
});

const ExecutiveSummarySchema = z.object({
  executive_summary: z.string(),
});

const RecommendationDraftSchema = z.object({
  text: z.string(),
});

export async function generateReport(
  extraction: ExtractionResult,
  onProgress?: (detail: string) => void,
): Promise<Report> {
  const validIds = new Set(extraction.evidence.map((e) => e.id));
  const byId = new Map(extraction.evidence.map((e) => [e.id, e]));

  // 1. Pool evidence by pillar. Source document is irrelevant to the logic here
  //    and matters only for citation display (spec §4.1).
  const pooled: Record<PillarKey, Evidence[]> = {
    governance: [],
    strategy: [],
    risk_management: [],
    metrics_targets: [],
  };
  for (const e of extraction.evidence) pooled[e.pillar].push(e);

  // 2. One call per pillar.
  const pillars = {} as Record<PillarKey, PillarAssessment>;

  for (const key of PILLAR_KEYS) {
    onProgress?.(`Assessing ${PILLAR_LABELS[key]}`);
    const evidence = pooled[key];
    const draft = await assessPillar(key, evidence, extraction.company_name);

    // Drop any evidence id the model invented — an unresolvable citation is the
    // one bug that would visibly break the report.
    const citedIds = draft.evidence_ids.filter((id) => validIds.has(id));

    pillars[key] = {
      completeness: draft.completeness,
      narrative: draft.narrative,
      evidence_ids: citedIds,
      score: scorePillar(draft.completeness, evidence),
    };
  }

  // 3 & 4. Overall score, then the executive summary over the four narratives.
  const overall = overallScore(PILLAR_KEYS.map((k) => pillars[k].score));

  onProgress?.("Writing executive summary");
  const { executive_summary } = await callModel({
    system:
      "You are a climate disclosure analyst writing the opening of a formal AASB S2 / TCFD readiness report. " +
      "Given the four pillar assessments, write a 2-3 sentence executive summary that a board member would read first. " +
      "State where the company stands overall, name its clearest strength and its most material gap. " +
      "Write in measured analyst prose. No bullet points, no headings, no hedging filler.",
    user: [
      `Company: ${extraction.company_name}`,
      `Overall readiness score: ${overall}/100`,
      "",
      ...PILLAR_KEYS.map(
        (k) =>
          `${PILLAR_LABELS[k]} — ${pillars[k].completeness} (${pillars[k].score}/100)\n${pillars[k].narrative}`,
      ),
    ].join("\n\n"),
    schema: ExecutiveSummarySchema,
    model: MODELS.narrative,
    maxTokens: 2000,
  });

  // 5. Findings: one per pillar rated Partial/Vague or Missing, plus the
  //    strongest well-substantiated pillar so the report recognises strength too.
  const findings = buildFindings(pillars, pooled);

  // 6. One recommendation per non-strong finding.
  const recommendations: Recommendation[] = [];
  for (const finding of findings) {
    if (finding.type === "Well-substantiated") continue;
    onProgress?.(`Drafting recommendation for ${PILLAR_LABELS[finding.pillar]}`);
    recommendations.push({
      pillar: finding.pillar,
      text: await recommendFor(finding, pooled[finding.pillar], extraction.company_name),
    });
  }

  return {
    company_name: extraction.company_name,
    generated_at: new Date().toISOString(),
    overall_readiness_score: overall,
    executive_summary,
    documents: extraction.documents,
    pillars,
    evidence: extraction.evidence,
    findings,
    recommendations,
  };
}

async function assessPillar(
  key: PillarKey,
  evidence: Evidence[],
  companyName: string,
): Promise<z.infer<typeof PillarAssessmentDraftSchema>> {
  const evidenceBlock =
    evidence.length === 0
      ? "(No evidence for this pillar was found in any provided document.)"
      : evidence
          .map(
            (e) =>
              `${e.id} [${e.document} p.${e.page}, confidence ${e.confidence.toFixed(2)}] ${e.claim}`,
          )
          .join("\n");

  return callModel({
    system:
      `You are a climate disclosure analyst assessing the ${PILLAR_LABELS[key]} pillar of an AASB S2 / TCFD readiness report.\n\n` +
      `Pillar definition:\n${PILLAR_DEFINITIONS[key]}\n\n` +
      `Assess the pooled evidence against these disclosure criteria:\n` +
      PILLAR_RUBRIC[key].map((c, i) => `${i + 1}. ${c}`).join("\n") +
      `\n\nReturn:\n` +
      `- completeness: "Well-substantiated" if the evidence addresses most criteria with specifics; ` +
      `"Partial / Vague" if it addresses some criteria, or addresses them only in general terms; ` +
      `"Missing" if there is little or no evidence against these criteria.\n` +
      `- narrative: one paragraph of 60-110 words in the voice of a professional analyst report. ` +
      `Say what the company does disclose, then what the evidence does not establish. ` +
      `Reference specifics from the evidence (committee names, figures, scenarios, years) wherever they exist. ` +
      `This paragraph is printed directly in the report, so write finished prose — no bullet points, no headings, ` +
      `no meta-commentary about evidence IDs or the assessment process.\n` +
      `- evidence_ids: the ids of the evidence items your narrative actually relies on. Use only ids listed below. ` +
      `Return an empty list if there is no evidence.`,
    user: `Company: ${companyName}\n\nPooled evidence for ${PILLAR_LABELS[key]}:\n${evidenceBlock}`,
    schema: PillarAssessmentDraftSchema,
    model: MODELS.narrative,
    maxTokens: 3000,
  });
}

function buildFindings(
  pillars: Record<PillarKey, PillarAssessment>,
  pooled: Record<PillarKey, Evidence[]>,
): Finding[] {
  const findings: Finding[] = [];
  let n = 1;
  const nextId = () => `f_${String(n++).padStart(3, "0")}`;

  for (const key of PILLAR_KEYS) {
    const pillar = pillars[key];
    if (pillar.completeness === "Well-substantiated") continue;
    findings.push({
      id: nextId(),
      pillar: key,
      type: pillar.completeness,
      summary:
        pillar.completeness === "Missing"
          ? `No substantive ${PILLAR_LABELS[key]} disclosure was found in any provided document.`
          : `${PILLAR_LABELS[key]} disclosure is present but incomplete against the AASB S2 criteria.`,
      evidence_ids: pillar.evidence_ids,
    });
  }

  // Surface the strongest pillar too, so the report recognises strength (spec §4.5).
  const strongest = PILLAR_KEYS.filter(
    (k) => pillars[k].completeness === "Well-substantiated",
  ).sort((a, b) => pillars[b].score - pillars[a].score)[0];

  if (strongest) {
    findings.push({
      id: nextId(),
      pillar: strongest,
      type: "Well-substantiated",
      summary: `${PILLAR_LABELS[strongest]} is the strongest pillar, supported by ${pooled[strongest].length} pieces of evidence across the provided documents.`,
      evidence_ids: pillars[strongest].evidence_ids,
    });
  }

  return findings;
}

async function recommendFor(
  finding: Finding,
  evidence: Evidence[],
  companyName: string,
): Promise<string> {
  const context =
    evidence.length === 0
      ? "(No evidence exists for this pillar.)"
      : evidence.map((e) => `- ${e.claim}`).join("\n");

  const { text } = await callModel({
    system:
      "You are a climate disclosure analyst writing one recommendation to close a specific gap in a company's AASB S2 / TCFD reporting.\n\n" +
      "Write a single, concrete action of 1-2 sentences. It must be specific to the gap described and to what this company already discloses — " +
      "name the actual disclosure that is missing. Do not give generic ESG advice, do not restate the gap, and do not recommend something " +
      "the evidence shows the company already does.",
    user:
      `Company: ${companyName}\n` +
      `Pillar: ${PILLAR_LABELS[finding.pillar]}\n` +
      `Gap: ${finding.summary}\n\n` +
      `Criteria for this pillar:\n${PILLAR_RUBRIC[finding.pillar].map((c) => `- ${c}`).join("\n")}\n\n` +
      `What the company currently discloses:\n${context}`,
    schema: RecommendationDraftSchema,
    model: MODELS.narrative,
    maxTokens: 1500,
  });

  return text;
}
