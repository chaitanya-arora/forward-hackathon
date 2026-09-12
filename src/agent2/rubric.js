// A small, fixed evidence-readiness rubric, not a rating of ESG performance.
export const rubric = [
  ["environmental", "emissionsEnergy", "Emissions and energy measurements with period and boundary"],
  ["environmental", "resources", "Waste, water or biodiversity impacts and management"],
  ["environmental", "transition", "Environmental targets, accountable plans and progress"],
  ["social", "workforce", "Workforce wellbeing, diversity or training with outcomes"],
  ["social", "safety", "Workplace safety processes and measured outcomes"],
  ["social", "valueChain", "Human rights, supply chain or community impact processes and outcomes"],
  ["governance", "oversight", "Board and executive ESG responsibilities and review processes"],
  ["governance", "ethics", "Ethics, compliance and reporting mechanisms"],
  ["governance", "risk", "Risk identification, management and accountability"],
].map(([section, key, description]) => ({ id: `${section}.${key}`, section, key, description }));

export const responseJsonSchema = {
  type: "object", required: ["assessments"], additionalProperties: false,
  properties: { assessments: { type: "array", items: {
    type: "object", additionalProperties: false,
    required: ["criterionId", "status", "citations", "potentialInconsistency"],
    properties: {
      criterionId: { type: "string", enum: rubric.map((r) => r.id) },
      status: { type: "string", enum: ["strong", "partial", "missing"] },
      potentialInconsistency: { type: "boolean" },
      citations: { type: "array", items: {
        type: "object", required: ["evidenceId", "quote"], additionalProperties: false,
        properties: { evidenceId: { type: "string" }, quote: { type: "string" } },
      } },
    },
  } } },
};
