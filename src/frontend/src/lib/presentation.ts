import { z } from "zod";

const finding = z.object({
  id: z.string().min(1), importance: z.enum(["high", "medium"]),
  title: z.string().min(1), summary: z.string(), section: z.string(),
  references: z.array(z.string()), evidenceIds: z.array(z.string()),
}).passthrough();
const action = z.object({
  id: z.string().min(1), priority: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1), description: z.string(), section: z.string(),
  reference: z.string().nullable(), actionType: z.enum(["provide_evidence", "human_confirmation",
    "professional_judgement", "resolve_conflict", "external_assurance", "director_action"]),
  evidenceIds: z.array(z.string()),
}).passthrough();
export const presentationSchema = z.object({
  executiveSummary: z.object({
    readinessScore: z.number().min(0).max(100).nullable(), readinessLabel: z.literal("Readiness"),
    scoreDisclaimer: z.string().min(1), headline: z.string().min(1), summary: z.string().min(1),
    requiresHumanReview: z.boolean(),
  }).passthrough(),
  keyFindings: z.array(finding), priorityActions: z.array(action),
}).passthrough();
export type Presentation = z.infer<typeof presentationSchema>;

// Validate only the envelope and rendered fields; preserve all detailed data.
const report = z.object({ company: z.string().min(1), presentation: presentationSchema }).passthrough();
export const runSchema = z.object({
  companyId: z.number().int().positive(), runId: z.number().int().positive(),
  stage: z.enum(["extracting", "aasb_analysing", "esg_analysing", "completed", "failed"]),
  stageLabel: z.string(), done: z.boolean(), error: z.object({
    code: z.enum(["AI_QUOTA_EXHAUSTED", "PROCESSING_FAILED"]), message: z.string().min(1),
  }).nullable(),
  reportIds: z.object({ aasbS2: z.number().int().positive().nullable(), esg: z.number().int().positive().nullable() }),
  aasbS2Report: report.extend({ reportType: z.literal("AASB_S2_DRAFT"),
    reportingPeriod: z.object({ year: z.string().nullable() }).passthrough(),
  }).nullable(),
  esgReport: report.extend({ reportType: z.literal("ESG_READINESS") }).nullable(),
}).passthrough();
