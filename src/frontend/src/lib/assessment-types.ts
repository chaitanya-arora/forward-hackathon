/**
 * Types for the real backend output — src/aasb/generateAasbS2Report.js and
 * src/agent2/generateESGReport.js. These are genuinely two independent
 * reports, not one document with two sections: different rubrics, different
 * status vocabularies (5-state for AASB, 3-state for ESG), generated and
 * stored separately.
 */

export const AASB_STATUSES = ["present", "partial", "missing", "not_applicable", "requires_human_judgement"] as const;
export type AasbStatus = (typeof AASB_STATUSES)[number];

export const ESG_STATUSES = ["strong", "partial", "missing"] as const;
export type EsgStatus = (typeof ESG_STATUSES)[number];

export interface Citation {
  evidenceId: string;
  quote: string;
}

export interface EvidenceItem {
  id: string;
  text: string;
  confidence: number | null;
  documentId: number | null;
  category: string | null;
  pillar: string | null;
  source: string | null;
  sourceType: "public" | "internal" | "unknown";
  pages: number[];
  pillarSourcePages: number[];
}

export interface AasbCriterion {
  id: string;
  section: string;
  key: string;
  description: string;
  reference: string;
  status: AasbStatus;
  citations: Citation[];
  applicabilityBasis: { type: string; [key: string]: unknown } | null;
  finding: string;
  requiredInformation: string[];
}

export interface AasbSectionBlock {
  overallStatus: AasbStatus;
  criteria: AasbCriterion[];
}

export interface AasbS2Report {
  presentation: import("./presentation").Presentation;
  reportType?: "AASB_S2_DRAFT";
  priority?: "primary";
  status: string;
  company: string;
  reportingPeriod: { year: string; startDate: string | null; endDate: string | null };
  standard: { name: string; version: string; source: string | null; amendmentReview: string | null };
  reportingApplicability: { assessment: string; requiresProfessionalConfirmation: boolean };
  aasbS2ReadinessScore: number | null;
  executiveSummary: {
    assessment: string;
    presentCriteria: number;
    criteriaRequiringAction: number;
    excludedCriteria: number;
    totalCriteria: number;
  };
  governance: AasbSectionBlock;
  strategy: AasbSectionBlock & Record<string, unknown>;
  riskManagement: AasbSectionBlock;
  metricsAndTargets: AasbSectionBlock & Record<string, unknown>;
  generalRequirements: AasbSectionBlock & Record<string, unknown>;
  evidenceRegister: EvidenceItem[];
  missingDisclosures: Array<{ criterionId: string; status: AasbStatus; requiredInformation: string[] }>;
  priorityActions: Array<{ criterionId: string; action: string }>;
  assuranceReadiness: { status: string; issues: string[] };
  directorsDeclaration: { requiredForStatutoryReport: boolean; status: string; note: string };
  lodgement: { lodgementReady: boolean; notes: string[] };
  methodology: {
    version: string;
    scoreMeaning: string;
    limitations: string;
    source: string | null;
    weights: Record<string, number>;
    humanInputs?: unknown;
  };
  warnings: string[];
}

export interface EsgCriterion {
  id: string;
  section: string;
  key: string;
  description: string;
  status: EsgStatus;
  gapType: string | null;
  citations: Citation[];
  recommendation: string;
}

export interface EsgSectionBlock {
  score: number;
  status: EsgStatus;
  strengths: Array<{ criterionId: string; citations: Citation[] }>;
  gaps: Array<{ criterionId: string; type: string; message: string }>;
  recommendations: string[];
  evidence: EvidenceItem[];
  criteria: EsgCriterion[];
}

export interface EsgReport {
  presentation: import("./presentation").Presentation;
  reportType?: "ESG_READINESS";
  priority?: "secondary";
  company: string;
  reportYear: string | null;
  executiveSummary: string;
  // The real backend emits both of these with the same value — a redundancy
  // in the source data (see the field-quality note in the project record),
  // not something invented here. overallESGScore is the one actually used.
  overallESGReadinessScore?: number;
  overallESGScore: number;
  environmental: EsgSectionBlock;
  social: EsgSectionBlock;
  governance: EsgSectionBlock;
  // Present in some backend versions, absent in others (the real Coles
  // output has no aasbS2 key at all) — optional rather than assumed.
  aasbS2?: {
    readinessScore: number;
    gaps: Array<{ criterionId: string; type: string; message: string }>;
    recommendations: string[];
    evidence: EvidenceItem[];
    [key: string]: unknown;
  };
  priorityActions: Array<{ criterionId: string; action: string }>;
  methodology: { version: string; scoreMeaning: string; limitations: string; statusWeights?: Record<string, number>; aggregation?: string };
  warnings: string[];
}

export const AASB_SECTION_LABELS: Record<string, string> = {
  governance: "Governance",
  strategy: "Strategy",
  riskManagement: "Risk Management",
  metricsAndTargets: "Metrics & Targets",
  generalRequirements: "General Requirements",
};

export const AASB_SECTION_KEYS = [
  "governance",
  "strategy",
  "riskManagement",
  "metricsAndTargets",
  "generalRequirements",
] as const;

export type RunStage = "extracting" | "aasb_analysing" | "esg_analysing" | "completed" | "failed";

export interface RunStatus {
  companyId: number;
  runId: number;
  stage: RunStage;
  stageLabel: string;
  done: boolean;
  error: { code: "AI_QUOTA_EXHAUSTED" | "PROCESSING_FAILED"; message: string } | null;
  reportIds: { aasbS2: number | null; esg: number | null };
  aasbS2Report: AasbS2Report | null;
  esgReport: EsgReport | null;
}
