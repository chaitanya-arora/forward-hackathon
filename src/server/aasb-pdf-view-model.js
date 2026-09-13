const sections = [
  ["governance", "Governance"],
  ["strategy", "Strategy"],
  ["riskManagement", "Risk Management"],
  ["metricsAndTargets", "Metrics & Targets"],
  ["generalRequirements", "General Requirements"],
];

const statusLabels = {
  complete: "Supported",
  evidence_found_requires_judgement: "Human review required",
  requires_human_confirmation: "Human review required",
  partial: "Partial evidence",
  missing: "Evidence missing",
  not_applicable: "Not applicable",
  requires_human_judgement: "Human review required",
};

function status(value) { return statusLabels[value] ?? "Review required"; }
function clean(value, fallback = "Not available") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  return String(value).trim() || fallback;
}
function readable(value) {
  return clean(value, "").split(/\s+Extracted:/i)[0]
    .replace(/\b[a-zA-Z]+\.([a-zA-Z]+)\b/g, "$1")
    .replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
function concise(value, limit = 240) {
  const text = readable(value);
  return text.length <= limit ? text : `${text.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}
function criteriaFor(report, key) { return Array.isArray(report[key]?.criteria) ? report[key].criteria : []; }
function criterionLabel(report, id) {
  for (const [key] of sections) {
    const criterion = criteriaFor(report, key).find((item) => item.id === id);
    if (criterion?.description) return criterion.description;
  }
  return "Evidence gap requiring review";
}

function sectionSummary(report) {
  return sections.map(([key, label]) => {
    const criteria = criteriaFor(report, key);
    const supported = criteria.filter((criterion) => criterion.completenessStatus === "complete").length;
    const excluded = criteria.filter((criterion) => criterion.completenessStatus === "not_applicable").length;
    return { key, label, status: status(report[key]?.overallStatus), supported, unresolved: criteria.length - supported - excluded, total: criteria.length };
  });
}

function actionGroup(action) {
  const value = `${action.title} ${action.description}`.toLowerCase();
  if (/scope 1|scope 2|scope 3|emission|metrics|target/.test(value)) return "Emissions, metrics and targets";
  if (/period|version|adoption|relief|applicab|cohort|materiality/.test(value)) return "Reporting basis and applicability";
  if (/director|declaration|approval/.test(value)) return "Management and director review";
  if (action.actionType === "external_assurance" || /assurance/.test(value)) return "Assurance and independent review";
  if (/governance|board|committee|responsib/.test(value)) return "Climate governance and oversight";
  return "Disclosure evidence and judgement";
}

function consolidatedActions(report) {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  const source = Array.isArray(report.presentation?.priorityActions) ? report.presentation.priorityActions : [];
  const groups = new Map();
  for (const action of source) {
    const group = actionGroup(action);
    const existing = groups.get(group);
    if (existing) {
      existing.count += 1;
      existing.references.push(action.reference);
      if (rank[action.priority] < rank[existing.priority]) {
        existing.priority = action.priority;
        existing.description = concise(action.description);
      }
      continue;
    }
    groups.set(group, { title: group, description: concise(action.description), priority: action.priority, count: 1, references: [action.reference] });
  }
  return [...groups.values()].sort((a, b) => (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4) || a.title.localeCompare(b.title)).slice(0, 7)
    .map((action) => ({ ...action, references: action.references.filter(Boolean).slice(0, 3) }));
}

function detailedSections(report) {
  return sections.map(([key, label]) => ({
    key, label, status: status(report[key]?.overallStatus),
    criteria: criteriaFor(report, key).map((criterion) => ({
      title: clean(criterion.description, "Disclosure requirement"),
      status: status(criterion.completenessStatus ?? criterion.status),
      finding: readable(criterion.finding) || "Review the supplied evidence and applicability.",
      requiredInformation: Array.isArray(criterion.requiredInformation) ? criterion.requiredInformation.map(readable) : [],
      references: [criterion.reference].filter(Boolean),
      supportingValues: Object.entries(criterion.extractedFacts ?? {}).flatMap(([key, fact]) => {
        if (fact?.value === null || fact?.value === undefined) return [];
        const value = Array.isArray(fact.value)
          ? `${fact.value.length} disclosed records (retained in the detailed report data)`
          : typeof fact.value === "object" ? "Structured disclosure retained in the detailed report data" : concise(fact.value, 120);
        return `${readable(key)}: ${value}`;
      }).slice(0, 4),
      sources: [...new Set((criterion.citations ?? []).map(citation =>
        `${clean(citation.source, "Source document")}${citation.pages?.length ? `, page ${citation.pages.join(", ")}` : ""}`))].slice(0, 3),
    })),
  }));
}

export function buildAasbPdfViewModel(report) {
  const presentation = report.presentation ?? {};
  const summary = presentation.executiveSummary ?? {};
  const gaps = Array.isArray(report.missingDisclosures) ? report.missingDisclosures : [];
  return {
    header: {
      company: clean(report.company?.name ?? report.company), reportingPeriod: clean(report.reportingPeriod?.year ?? report.reporting?.year),
      reportStatus: clean(report.status), standard: clean(report.standard?.name, "AASB S2"), standardVersion: clean(report.standard?.version),
    },
    executiveSummary: {
      readinessScore: summary.readinessScore ?? report.aasbS2ReadinessScore ?? null,
      headline: clean(summary.headline), summary: clean(summary.summary), disclaimer: clean(summary.scoreDisclaimer, "Internal evidence-readiness measure; not percentage compliance."),
    },
    sectionSummary: sectionSummary(report),
    keyFindings: (Array.isArray(presentation.keyFindings) ? presentation.keyFindings : []).slice(0, 6).map((finding) => ({ title: clean(finding.title), summary: clean(finding.summary), importance: clean(finding.importance, "medium") })),
    priorityActions: consolidatedActions(report),
    majorEvidenceGaps: gaps.slice(0, 5).map((gap) => ({ title: criterionLabel(report, gap.criterionId), detail: Array.isArray(gap.requiredInformation) ? concise(gap.requiredInformation.join(" "), 160) : "Review the supporting evidence." })),
    reviewAndAssurance: [...(Array.isArray(report.assuranceReadiness?.issues) ? report.assuranceReadiness.issues : []), ...(Array.isArray(report.warnings) ? report.warnings : [])].slice(0, 4).map(value => concise(value).replace(/\bESG evidence\b/g, "document evidence")),
    detailedSections: detailedSections(report),
  };
}
