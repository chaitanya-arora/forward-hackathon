import { z } from "zod";

/**
 * The §2 data contract. This file is the single source of truth: the same schemas
 * constrain the model's output (via zodOutputFormat) on the backend and type the
 * report view on the frontend. There is no second copy to drift from.
 */

export const PILLAR_KEYS = [
  "governance",
  "strategy",
  "risk_management",
  "metrics_targets",
] as const;

export const PillarKeySchema = z.enum(PILLAR_KEYS);
export type PillarKey = z.infer<typeof PillarKeySchema>;

export const PILLAR_LABELS: Record<PillarKey, string> = {
  governance: "Governance",
  strategy: "Strategy",
  risk_management: "Risk Management",
  metrics_targets: "Metrics & Targets",
};

export const COMPLETENESS_VALUES = [
  "Well-substantiated",
  "Partial / Vague",
  "Missing",
] as const;

export const CompletenessSchema = z.enum(COMPLETENESS_VALUES);
export type Completeness = z.infer<typeof CompletenessSchema>;

// ---------------------------------------------------------------------------
// Agent 1 — extraction output
// ---------------------------------------------------------------------------

export const SourceDocumentSchema = z.object({
  filename: z.string(),
  /**
   * Free-text metadata for citation transparency only. It does NOT drive any
   * comparison logic — all evidence pools together regardless of its source.
   */
  label: z.string(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  pillar: PillarKeySchema,
  claim: z.string(),
  document: z.string(),
  page: z.number().int(),
  confidence: z.number().min(0).max(1),
  raw_text_snippet: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ExtractionResultSchema = z.object({
  company_name: z.string(),
  documents: z.array(SourceDocumentSchema),
  evidence: z.array(EvidenceSchema),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ---------------------------------------------------------------------------
// Agent 2 — the report
// ---------------------------------------------------------------------------

export const PillarAssessmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  completeness: CompletenessSchema,
  narrative: z.string(),
  evidence_ids: z.array(z.string()),
});
export type PillarAssessment = z.infer<typeof PillarAssessmentSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  pillar: PillarKeySchema,
  type: CompletenessSchema,
  summary: z.string(),
  evidence_ids: z.array(z.string()),
});
export type Finding = z.infer<typeof FindingSchema>;

export const RecommendationSchema = z.object({
  pillar: PillarKeySchema,
  text: z.string(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const ReportSchema = z.object({
  company_name: z.string(),
  generated_at: z.string(),
  overall_readiness_score: z.number().int().min(0).max(100),
  executive_summary: z.string(),
  documents: z.array(SourceDocumentSchema),
  pillars: z.record(PillarKeySchema, PillarAssessmentSchema),
  evidence: z.array(EvidenceSchema),
  findings: z.array(FindingSchema),
  recommendations: z.array(RecommendationSchema),
});
export type Report = z.infer<typeof ReportSchema>;

// ---------------------------------------------------------------------------
// Job status (polled by the processing screen)
// ---------------------------------------------------------------------------

export const JOB_STAGES = [
  "queued",
  "reading documents",
  "extracting",
  "analyzing pillars",
  "generating report",
  "done",
  "error",
] as const;

export const JobStageSchema = z.enum(JOB_STAGES);
export type JobStage = z.infer<typeof JobStageSchema>;

export const JobStatusSchema = z.object({
  jobId: z.string(),
  stage: JobStageSchema,
  detail: z.string().optional(),
  done: z.boolean(),
  error: z.string().optional(),
  result: ReportSchema.optional(),
  /**
   * Real counts from the running pipeline, so the processing screen can show
   * actual progress. Absent until extraction starts producing them.
   */
  progress: z
    .object({
      chunks_done: z.number().int(),
      chunks_total: z.number().int(),
      evidence_found: z.number().int(),
    })
    .optional(),
});
export type JobStatus = z.infer<typeof JobStatusSchema>;
