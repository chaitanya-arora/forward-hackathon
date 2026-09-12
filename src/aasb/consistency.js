import { prepareContext, resolveStandard } from "./context.js";

export function reconcileContext(rawContext, facts) {
  const configured = prepareContext(rawContext);
  const effective = structuredClone(configured);
  const issues = [];
  const add = (field, configuredValue, evidenceValue, evidenceIds, action, severity="high") => issues.push({field,severity,configuredValue,evidenceValue,evidenceIds,
    status:"requires_human_confirmation",action});
  for (const [key, part] of [["reportingPeriodStart","startDate"],["reportingPeriodEnd","endDate"]]) {
    const dates = [...new Set(facts.reportingPeriods.map(p=>p.value[part]).filter(Boolean))];
    if (dates.length > 1 || (dates.length === 1 && configured[key] && configured[key] !== dates[0])) {
      add(key,configured[key],dates,facts.reportingPeriods.flatMap(p=>p.evidenceIds),"Confirm the authoritative reporting period and distinguish comparative periods.");
      effective[key]=null;
    } else if (!configured[key] && dates.length===1) effective[key]=dates[0];
  }
  for (const [key, factKey] of [["earlyAdoptionOf2025Amendments","earlyAmendmentAdoption"],
    ["firstAnnualPeriodApplyingAasbS2","firstYearOfApplication"], ["useComparativesFirstYearRelief","comparativesRelief"], ["useScope3FirstYearRelief","scope3Relief"]]) {
    const fact=facts.adoption[factKey];
    if (fact.status === "requires_human_confirmation" || (fact.value !== null && configured[key] !== null && fact.value !== configured[key])) {
      add(key,configured[key],fact.candidates.map(c=>c.value),fact.evidenceIds,"Resolve the configured input against explicit adoption or relief-election evidence.");
      effective[key]=null;
    } else if(configured[key] === null && fact.value !== null) effective[key]=fact.value;
  }
  if (effective.firstAnnualPeriodApplyingAasbS2 === false && (effective.useComparativesFirstYearRelief || effective.useScope3FirstYearRelief)) {
    add("transitionReliefs",effective.firstAnnualPeriodApplyingAasbS2,"relief election",[],"Confirm first-year eligibility and elected reliefs.");
    effective.useComparativesFirstYearRelief=null; effective.useScope3FirstYearRelief=null;
  }
  const differentEmissionsPeriods=facts.emissionsReportingPeriods.filter(p=>
    (p.value.startDate && effective.reportingPeriodStart && p.value.startDate!==effective.reportingPeriodStart) ||
    (p.value.endDate && effective.reportingPeriodEnd && p.value.endDate!==effective.reportingPeriodEnd));
  if(differentEmissionsPeriods.length) add("emissionsReportingPeriod",[effective.reportingPeriodStart,effective.reportingPeriodEnd],differentEmissionsPeriods.map(p=>p.value),
    differentEmissionsPeriods.flatMap(p=>p.evidenceIds),"Review the different emissions period and conditions for its use under B19; difference alone is not non-compliance.","medium");
  if(effective.reportingPeriodStart && effective.reportingPeriodEnd && effective.reportingPeriodEnd < effective.reportingPeriodStart) {
    add("reportingPeriod",[effective.reportingPeriodStart,effective.reportingPeriodEnd],null,[],"Resolve reversed reporting-period dates.");
    effective.reportingPeriodStart=null;effective.reportingPeriodEnd=null;
  }
  const standard=resolveStandard(effective);
  for(const [key,candidates] of [["provider",facts.assuranceProvider.candidates],["level",facts.assuranceLevels],
    ["scope",[...facts.reviewedAreas.candidates,...facts.auditedAreas.candidates]]]) {
    const expected=configured.expectedAssurance[key];
    if(expected && candidates.length && !candidates.some(c=>String(c.value).toLowerCase()===expected.toLowerCase()))
      add(`assurance.${key}`,expected,candidates.map(c=>c.value),candidates.flatMap(c=>c.evidenceIds),"Confirm the assurance provider, engagement level and scope against the signed source report.");
  }
  if(issues.some(i=>i.field==="earlyAdoptionOf2025Amendments" || i.field==="reportingPeriodStart")) {
    standard.version="unknown_requires_confirmation";standard.source=null;standard.operativeFrom=null;
    standard.selectionBasis="conflicting_metadata_requires_confirmation";
  } else if(facts.adoption.earlyAmendmentAdoption.value===true && configured.earlyAdoptionOf2025Amendments===null) standard.selectionBasis="reporting_period_start_and_explicit_source_early_adoption";
  return {configured,effective,issues,standard};
}
