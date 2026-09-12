// Conceptual information requirements, independent of company, language order,
// reporting year and PDF layout. A preparation checklist, not a legal opinion.
const elements = {
  responsibleBody: ["governingBody", "oversightResponsibilities"],
  responsibilities: ["mandate", "accountability"], competencies: ["skills", "skillsAssessment"],
  informationFlow: ["informationProcess", "frequency"], decisions: ["decisionProcess", "tradeOffs"],
  targetOversight: ["targetReview", "progressMonitoring"], managementRole: ["managementBody", "delegation"],
  controls: ["controls", "integration"], remuneration: ["remunerationLink", "targetLink"],
  identifiedRisks: ["risks", "effects"], identifiedOpportunities: ["opportunities", "effects"],
  riskClassification: ["risks", "classification"], timeHorizons: ["shortTerm", "mediumTerm", "longTerm"],
  horizonDefinitions: ["horizonDefinitions", "planningLink"], businessModel: ["currentEffects", "anticipatedEffects"],
  valueChain: ["valueChainBoundary", "concentrations", "effects"], responses: ["responses", "implementation"],
  transitionPlan: ["plan", "dependencies", "assumptions"], resourceAllocation: ["resources", "funding"],
  currentFinancialEffects: ["financialEffects", "financialStatementLink", "measurementBasis"],
  anticipatedFinancialEffects: ["financialEffects", "timeHorizons", "measurementBasis"],
  financialPlanning: ["funding", "financialPlanningLink"], resilience: ["results", "uncertainties", "adaptiveCapacity"],
  scenarioAnalysis: ["scenarioSet", "temperaturePathways", "methodology", "dataSources", "assumptions", "timeHorizons", "results"],
  identification: ["identificationProcess", "scope"], assessment: ["assessmentProcess", "parameters"],
  prioritisation: ["prioritisationProcess", "enterpriseComparison"], monitoring: ["monitoringProcess", "changes"],
  inputs: ["dataSources", "parameters", "scope"], scenarioUse: ["scenarioUse", "identificationLink"],
  likelihoodMagnitude: ["likelihood", "magnitude", "methods"], opportunityProcesses: ["opportunityProcess", "monitoringProcess"],
  enterpriseIntegration: ["integration", "enterpriseProcess"],
  scope1: ["value", "unit", "period", "boundary"], scope2: ["locationBasedValue", "unit", "period", "boundary", "contractualInstruments"],
  scope3: ["value", "unit", "period", "boundary"], methodology: ["methodology", "measurementApproach", "changes"],
  assumptionsQuality: ["assumptions", "inputs", "dataLimitations"], scope3Categories: ["categories", "coverage"],
  transitionRiskExposure: ["amount", "percentage", "boundary", "period"], physicalRiskExposure: ["amount", "percentage", "boundary", "period"],
  climateOpportunityExposure: ["amount", "percentage", "boundary", "period"], capitalDeployment: ["amount", "purpose", "period"],
  internalCarbonPrice: ["use", "priceOrExplicitNonUse", "application"], executiveRemuneration: ["remunerationLink", "percentageOrExplicitNonUse", "period"],
  targets: ["description", "metric", "objective", "boundary"], basePeriods: ["baselineYear", "baselineValue"],
  targetPeriods: ["targetYear", "startYear"], milestones: ["milestones", "milestoneDates"],
  targetBasis: ["absoluteOrIntensity", "grossOrNet", "gasesCovered"], progress: ["progress", "period", "trendExplanation"],
  targetMethods: ["methodology", "validation", "reviewProcess", "recalculations"],
  materiality: ["materialityProcess", "judgements"], fairPresentation: ["reviewProcess", "balancedInformation"],
  reportingEntityConsistency: ["reportingEntity", "financialStatementEntity"], connectedInformation: ["connections", "explanation"],
  financialStatementConnections: ["financialStatementLink", "consistentAssumptions"], reportingPeriod: ["periodStart", "periodEnd", "alignment"],
  judgements: ["judgements", "basis"], measurementUncertainty: ["uncertainAmounts", "sourcesOfUncertainty", "assumptions"],
  comparatives: ["comparativeInformationOrElectedRelief", "basis"], transitionReliefs: ["firstYearOfApplication", "elections", "eligibilityBasis"],
  metricConsistency: ["comparativeMethods", "changesOrExplicitNoChange"], metricSources: ["sources", "definitions", "methodology"],
};

export function requirementFor(rule) {
  if (!elements[rule.key]) throw new Error(`Missing requirement definition: ${rule.id}`);
  return { ...rule, requiredElements: elements[rule.key], requiresProfessionalJudgement: true };
}

export const completenessWeights = {
  complete: 1, evidence_found_requires_judgement: 0.75, partial: 0.5,
  requires_human_confirmation: 0.25, missing: 0,
};
