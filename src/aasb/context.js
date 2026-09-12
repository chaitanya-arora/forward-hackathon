import { aasbRubric } from "./rubric.js";

export const standardVersions = [
  { version: "2024-09", operativeFrom: "2025-01-01", url: "https://standards.aasb.gov.au/aasb-s2-sep-2024" },
  { version: "2025-12", operativeFrom: "2027-01-01", earlyApplicationFrom: "2025-01-01", url: "https://standards.aasb.gov.au/aasb-s2-dec-2025" },
];
function date(value, field) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new TypeError(`${field} must be a valid YYYY-MM-DD date.`);
  return value;
}
function boolean(value, field) {
  if (value != null && typeof value !== "boolean") throw new TypeError(`${field} must be boolean when supplied.`);
  return value ?? null;
}
export function prepareContext(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Reporting context must be an object.");
  const start = date(raw.reportingPeriodStart, "reportingPeriodStart");
  const end = date(raw.reportingPeriodEnd, "reportingPeriodEnd");
  if (start && end && end < start) throw new TypeError("Reporting period end precedes its start.");
  const early = boolean(raw.earlyAdoptionOf2025Amendments, "earlyAdoptionOf2025Amendments");
  const first = boolean(raw.firstAnnualPeriodApplyingAasbS2, "firstAnnualPeriodApplyingAasbS2");
  const scope3 = boolean(raw.useScope3FirstYearRelief, "useScope3FirstYearRelief");
  const comparatives = boolean(raw.useComparativesFirstYearRelief, "useComparativesFirstYearRelief");
  if (scope3 && first === false) throw new TypeError("Scope 3 first-year relief contradicts firstAnnualPeriodApplyingAasbS2=false.");
  const size = raw.companySize ?? {};
  if (!size || typeof size !== "object" || Array.isArray(size)) throw new TypeError("companySize must be an object.");
  for (const key of ["revenueAud", "assetsAud", "employees"]) {
    if (size[key] != null && (!Number.isFinite(size[key]) || size[key] < 0 || (key === "employees" && !Number.isInteger(size[key])))) throw new TypeError(`Invalid companySize.${key}.`);
  }
  const notApplicable = raw.confirmedNotApplicable ?? {};
  const expectedAssurance = raw.expectedAssurance ?? {};
  if(!expectedAssurance || typeof expectedAssurance!=="object" || Array.isArray(expectedAssurance))throw new TypeError("expectedAssurance must be an object.");
  for(const key of ["provider","level","scope"])if(expectedAssurance[key]!=null && (typeof expectedAssurance[key]!=="string" || !expectedAssurance[key].trim()))throw new TypeError(`Invalid expectedAssurance.${key}`);
  if (!notApplicable || typeof notApplicable !== "object" || Array.isArray(notApplicable)) throw new TypeError("confirmedNotApplicable must be an object.");
  for (const [id, value] of Object.entries(notApplicable)) {
    if (!aasbRubric.some(r => r.id === id) || !value || typeof value.reason !== "string" || !value.reason.trim() || typeof value.confirmedBy !== "string" || !value.confirmedBy.trim()) throw new TypeError(`Not-applicable confirmation requires a valid criterion, reason and confirmedBy: ${id}`);
    if (value.reason.length > 1000 || value.confirmedBy.length > 200) throw new TypeError("Human confirmation is too long.");
  }
  return { reportingPeriodStart: start, reportingPeriodEnd: end, earlyAdoptionOf2025Amendments: early,
    firstAnnualPeriodApplyingAasbS2: first, useScope3FirstYearRelief: scope3, useComparativesFirstYearRelief: comparatives,
    companySize: { revenueAud: size.revenueAud ?? null, assetsAud: size.assetsAud ?? null, employees: size.employees ?? null },
    confirmedNotApplicable: structuredClone(notApplicable),expectedAssurance:{provider:expectedAssurance.provider??null,level:expectedAssurance.level??null,scope:expectedAssurance.scope??null} };
}

export function resolveStandard(context) {
  const start = context.reportingPeriodStart;
  let selected = start ? standardVersions.filter(v => v.operativeFrom <= start).at(-1) : null;
  if (start && context.earlyAdoptionOf2025Amendments && start >= "2025-01-01" && start < "2027-01-01") selected = standardVersions.find(v => v.version === "2025-12");
  return { name: "AASB S2 Climate-related Disclosures", version: selected?.version ?? "unknown_requires_confirmation",
    reportingPeriodStart: start, earlyAmendmentAdoption: context.earlyAdoptionOf2025Amendments,
    operativeFrom: selected?.operativeFrom ?? null, source: selected?.url ?? null,
    selectionBasis: selected ? "reporting_period_start_and_explicit_early_adoption_input" : "reporting_period_start_missing_or_outside_supported_periods",
    amendmentReview: selected?.version === "2025-12" ? "Human review required for amended GHG measurement, financed emissions, jurisdictional reliefs and C6 comparatives; no relief is inferred." : null,
  };
}
export function transitionReliefs(context, standard) {
  const known = standard.version !== "unknown_requires_confirmation" && context.firstAnnualPeriodApplyingAasbS2 !== null;
  const first = known && context.firstAnnualPeriodApplyingAasbS2 === true;
  return { transitionReliefStatus: !known ? "unknown_requires_confirmation" : first ? "first_application_confirmed_by_user" : "not_first_application_period",
    basis: "User-supplied first-application-period confirmation; not independently verified.",
    comparatives: { eligible: known ? first : null, applied: first && context.useComparativesFirstYearRelief === true, electionConfirmed: context.useComparativesFirstYearRelief, reference: "C3" },
    scope3: { eligible: known ? first : null, applied: first && context.useScope3FirstYearRelief === true, electionConfirmed: context.useScope3FirstYearRelief, reference: "C4(b)" },
    otherReliefs: "Alternative GHG methodology, amendment-specific reliefs and other conditions require human review; not automatically applied.",
  };
}

const groups = [
  { group: 1, from: "2025-01-01", revenueAud: 500e6, assetsAud: 1e9, employees: 500 },
  { group: 2, from: "2026-07-01", revenueAud: 200e6, assetsAud: 500e6, employees: 250 },
  { group: 3, from: "2027-07-01", revenueAud: 50e6, assetsAud: 25e6, employees: 100 },
];
export function assessApplicability(context) {
  const tests = groups.map(g => ({ group: g.group, commencement: g.from,
    met: ["revenueAud", "assetsAud", "employees"].filter(k => context.companySize[k] !== null && context.companySize[k] >= g[k]),
  }));
  const candidate = tests.find(t => t.met.length >= 2);
  const missing = Object.entries(context.companySize).filter(([,v]) => v === null).map(([k]) => k);
  return { assessment: candidate ? `likely_group_${candidate.group}` : missing.length ? "unknown" : "no_size_group_identified",
    basis: candidate ? candidate.met.map(k => `${k} meets the supplied group ${candidate.group} size threshold.`) : [],
    sizeInputs: context.companySize, missingSizeInputs: missing,
    applicableFrom: candidate?.commencement ?? null,
    periodTiming: !candidate || !context.reportingPeriodStart ? "unknown" : context.reportingPeriodStart >= candidate.commencement ? "on_or_after_group_commencement" : "before_group_commencement",
    otherTestsNotAssessed: ["NGER status", "entity type / investment entity criteria", "Chapter 2M reporting obligation"],
    requiresProfessionalConfirmation: true,
    source: "https://www.asic.gov.au/regulatory-resources/sustainability-reporting/for-preparers-of-sustainability-reports/who-must-prepare-a-sustainability-report",
  };
}
