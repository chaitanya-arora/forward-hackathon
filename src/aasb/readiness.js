import { requirementFor, completenessWeights } from "./requirements.js";
import { validateCitations } from "../agent2/validateCitations.js";
import { sourceReference } from "./extractFacts.js";

const sections=["governance","strategy","riskManagement","metricsAndTargets","generalRequirements"];
function citationsFor(citations,input) {
  return citations.map(c=>{
    const source=input.evidence.find(e=>e.id===c.evidenceId);
    const start=source.text.indexOf(c.quote);
    return {...sourceReference(source,start,start+c.quote.length),quote:c.quote.slice(0,220),excerpt:c.quote.slice(0,220)};
  });
}
function measure(records) {
  const values=[...new Set(records.map(r=>JSON.stringify(r.value)))];
  const unique=values.length===1 ? records[0].value : null;
  return {value:unique?.value ?? null,unit:unique?.unit ?? null,normalized:unique?.normalized ?? null,
    status:!records.length ? "missing" : values.length>1 ? "requires_human_confirmation" : "extracted_requires_verification",
    evidenceIds:[...new Set(records.flatMap(r=>r.evidenceIds))],observations:records};
}
function action(issue,reference,evidence,needed,severity="medium") {
  return {issue,whyItMatters:"Required disclosure information or preparation decisions remain unverified.",reference,
    currentEvidence:evidence,informationStillNeeded:needed,severity,recommendedNextStep:needed.join("; "),action:needed.join("; ")};
}

export function enrichReadiness(report,input,result,facts,metadata) {
  const criteria=sections.flatMap(s=>report[s].criteria);
  const byId=new Map(result.assessments.map(a=>[a.criterionId,a]));
  const emissionData={scope1:measure(facts.emissions.filter(r=>r.value.scope===1)),
    scope2LocationBased:measure(facts.emissions.filter(r=>r.value.scope===2 && r.value.basis==="location-based")),
    scope2MarketBased:measure(facts.emissions.filter(r=>r.value.scope===2 && r.value.basis==="market-based")),
    scope2UnspecifiedBasis:measure(facts.emissions.filter(r=>r.value.scope===2 && !r.value.basis)),
    scope3:measure(facts.emissions.filter(r=>r.value.scope===3)),
    reportingPeriod:facts.emissionsReportingPeriods,boundary:facts.boundary,methodology:facts.methodology,
    emissionsFactors:facts.emissionsFactors,assumptions:facts.assumptions,estimationApproaches:facts.estimationApproaches,
    dataLimitations:facts.dataLimitations,recalculations:facts.recalculations,categories:facts.categories};
  const unresolved=[];
  for(const criterion of criteria) {
    const requirement=requirementFor(criterion);
    const assessment=byId.get(criterion.id);
    const elements=assessment.elements ?? [];
    if(!Array.isArray(elements)) throw new Error(`Invalid requirement elements for ${criterion.id}`);
    const checked=new Map();
    for(const element of elements) {
      if(!requirement.requiredElements.includes(element?.elementId) || checked.has(element.elementId)
        || !["explicit","partial","requires_human_confirmation"].includes(element.status)) throw new Error(`Invalid or duplicate requirement element for ${criterion.id}`);
      const citations=validateCitations(element.citations,input,criterion.id);
      checked.set(element.elementId,{...element,citations});
    }
    const extracted={};
    for(const key of requirement.requiredElements) {
      const item=checked.get(key);
      extracted[key]={value:null,status:item?.citations.length ? item.status==="explicit" ? "evidence_found_requires_judgement" : item.status : "missing",
        evidenceIds:[...new Set((item?.citations ?? []).map(c=>c.evidenceId))],evidence:citationsFor(item?.citations ?? [],input)};
    }
    // Objective values are credited only when explicit parsers found them.
    // Qualitative element selections still require professional judgement.
    const put=(key,value,evidenceIds=[])=>{if(extracted[key] && value!==null && value!==undefined) extracted[key]={value,status:"extracted_requires_verification",basis:evidenceIds.length ? "source_evidence" : "configured_input",evidenceIds};};
    const metric=criterion.key==="scope1" ? emissionData.scope1 : criterion.key==="scope2" ? emissionData.scope2LocationBased : criterion.key==="scope3" ? emissionData.scope3 : null;
    if(metric) {
      put(criterion.key==="scope2" ? "locationBasedValue" : "value",metric.value,metric.evidenceIds);
      put("unit",metric.unit,metric.evidenceIds);
      if(facts.emissionsReportingPeriods.length===1)put("period",facts.emissionsReportingPeriods[0].value,facts.emissionsReportingPeriods[0].evidenceIds);
      put("boundary",facts.boundary.value,facts.boundary.evidenceIds);
      // A generic quotation is not enough to supply a missing numeric element.
      for(const key of requirement.requiredElements) if(extracted[key].status==="evidence_found_requires_judgement") extracted[key].status="missing";
    }
    if(criterion.key==="responsibleBody") put("governingBody",facts.governingBody.value,facts.governingBody.evidenceIds);
    const quantitative=facts[criterion.key];
    if(["physicalRiskExposure","transitionRiskExposure","capitalDeployment","internalCarbonPrice","executiveRemuneration"].includes(criterion.key) && quantitative.value) {
      put("amount",quantitative.value.amount,quantitative.evidenceIds);
      put("percentage",quantitative.value.percentage,quantitative.evidenceIds);
      put("percentageOrExplicitNonUse",quantitative.value.explicitNonUse ? "explicit non-use" : quantitative.value.percentage,quantitative.evidenceIds);
      put("priceOrExplicitNonUse",quantitative.value.explicitNonUse ? "explicit non-use" : quantitative.value.amount,quantitative.evidenceIds);
      if(quantitative.value.explicitNonUse)put("use",false,quantitative.evidenceIds);
    }
    const targetField=({basePeriods:"baselineYear",targetPeriods:"targetYear",milestones:"milestones",targetBasis:"absoluteOrIntensity",progress:"progress",targetMethods:"methodology"})[criterion.key];
    if(targetField) {
      const values=facts.targets.filter(t=>t.value[targetField]!==null);
      if(values.length)put(targetField,values.map(t=>({value:t.value[targetField],targetDescription:t.value.description,evidenceIds:t.evidenceIds})),values.flatMap(t=>t.evidenceIds));
    }
    if(criterion.key==="reportingPeriod") {
      put("periodStart",metadata.effective.reportingPeriodStart,facts.reportingPeriods.flatMap(p=>p.evidenceIds));
      put("periodEnd",metadata.effective.reportingPeriodEnd,facts.reportingPeriods.flatMap(p=>p.evidenceIds));
    }
    if(criterion.key==="transitionReliefs") {
      put("firstYearOfApplication",metadata.effective.firstAnnualPeriodApplyingAasbS2,facts.adoption.firstYearOfApplication.evidenceIds);
      if(metadata.effective.useComparativesFirstYearRelief!==null && metadata.effective.useScope3FirstYearRelief!==null)
        put("elections",{comparatives:metadata.effective.useComparativesFirstYearRelief,scope3:metadata.effective.useScope3FirstYearRelief},[...facts.adoption.comparativesRelief.evidenceIds,...facts.adoption.scope3Relief.evidenceIds]);
    }
    if(criterion.key==="scenarioAnalysis") {
      if(facts.scenarios.length)put("scenarioSet",facts.scenarios.map(s=>s.value),facts.scenarios.flatMap(s=>s.evidenceIds));
      if(facts.scenarioTemperatures.length)put("temperaturePathways",facts.scenarioTemperatures.map(s=>s.value),facts.scenarioTemperatures.flatMap(s=>s.evidenceIds));
      for(const key of ["methodology","dataSources","assumptions","results"])put(key,facts[key].value,facts[key].evidenceIds);
      if(facts.timeHorizons.candidates.length)put("timeHorizons",facts.timeHorizons.candidates.map(c=>c.value),facts.timeHorizons.evidenceIds);
    }
    criterion.requiredElements=requirement.requiredElements;
    criterion.extractedFacts=extracted;
    criterion.satisfiedElements=Object.keys(extracted).filter(k=>["evidence_found_requires_judgement","extracted_requires_verification"].includes(extracted[k].status));
    criterion.missingElements=requirement.requiredElements.filter(k=>!criterion.satisfiedElements.includes(k));
    let completeness=criterion.status==="not_applicable" ? "not_applicable" : criterion.status==="requires_human_judgement" ? "requires_human_confirmation"
      : !criterion.missingElements.length && criterion.satisfiedElements.length ? "evidence_found_requires_judgement"
      : criterion.satisfiedElements.length || [...checked.values()].some(e=>e.citations.length) ? "partial" : criterion.citations.length ? "evidence_found_requires_judgement" : "missing";
    // Relevant excerpts without required-element extraction cannot earn 0.75.
    if(completeness==="evidence_found_requires_judgement" && criterion.missingElements.length) completeness="partial";
    if(metric && !criterion.missingElements.length && criterion.status!=="not_applicable") completeness="complete";
    if([...checked.values()].some(e=>e.status==="requires_human_confirmation"))completeness="requires_human_confirmation";
    const usedIds=[...criterion.citations.map(c=>c.evidenceId),...Object.values(extracted).flatMap(f=>f.evidenceIds)];
    const lowConfidence=usedIds.some(id=>{const source=input.evidence.find(e=>e.id===id);return source?.confidence!==null && source?.confidence<0.5;});
    if(lowConfidence && ["complete","evidence_found_requires_judgement"].includes(completeness))completeness="partial";
    const affected=metadata.issues.filter(i=>(/reportingPeriod|emissionsReportingPeriod/.test(i.field) && (criterion.key==="reportingPeriod" || metric))
      || (/Adoption|Relief|firstAnnual/i.test(i.field) && ["transitionReliefs","comparatives","scope3","scope3Categories"].includes(criterion.key)));
    const unknownRelief=criterion.key==="transitionReliefs" && (metadata.effective.firstAnnualPeriodApplyingAasbS2===null || metadata.effective.useComparativesFirstYearRelief===null || metadata.effective.useScope3FirstYearRelief===null);
    if(affected.length || (unknownRelief && criterion.status!=="not_applicable")) completeness="requires_human_confirmation";
    criterion.completenessStatus=completeness;
    criterion.requiresHumanJudgement=completeness!=="complete" && completeness!=="not_applicable";
    criterion.requiresHumanReview=true;
    criterion.status=({complete:"present",partial:"partial",evidence_found_requires_judgement:"requires_human_judgement",requires_human_confirmation:"requires_human_judgement",missing:"missing",not_applicable:"not_applicable"})[completeness];
    criterion.citations=citationsFor(criterion.citations,input);
    criterion.evidenceIds=[...new Set([...criterion.citations.map(c=>c.evidenceId),...Object.values(extracted).flatMap(f=>f.evidenceIds)])];
    criterion.finding=`${criterion.description}: ${criterion.satisfiedElements.length}/${criterion.requiredElements.length} information elements extracted or supported.`+
      (criterion.missingElements.length ? ` Still needed: ${criterion.missingElements.join(", ")}.` : " All listed elements have support; verify interpretation and scope.");
    const values=Object.entries(extracted).filter(([,f])=>f.value!==null);
    if(values.length)criterion.finding+=` Extracted: ${values.map(([key,f])=>`${key}=${JSON.stringify(f.value)}`).join("; ")}.`;
    criterion.requiredInformation=criterion.missingElements.map(k=>`Provide or verify ${k} for ${criterion.description}.`);
    if(criterion.requiresHumanJudgement)unresolved.push({criterionId:criterion.id,reference:criterion.reference,evidenceIds:criterion.evidenceIds,reason:completeness});
  }
  const scored=criteria.filter(c=>c.completenessStatus!=="not_applicable");
  const rawScore=scored.length ? Math.round(scored.reduce((sum,c)=>sum+completenessWeights[c.completenessStatus],0)/scored.length*100) : null;
  const caps=[];
  if(metadata.issues.some(i=>i.severity==="high"))caps.push({maximum:75,reason:"High-severity metadata conflict"});
  if(metadata.standard.version==="unknown_requires_confirmation")caps.push({maximum:90,reason:"Standard version unresolved"});
  if(unresolved.length)caps.push({maximum:95,reason:"Unresolved requirement judgements"});
  const score=rawScore===null ? null : Math.min(rawScore,...caps.map(c=>c.maximum));
  report.aasbS2ReadinessScore=score;
  report.standard=metadata.standard;
  report.reportingPeriod={year:input.reportYear,startDate:metadata.effective.reportingPeriodStart,endDate:metadata.effective.reportingPeriodEnd,
    configured:{startDate:metadata.configured.reportingPeriodStart,endDate:metadata.configured.reportingPeriodEnd},
    extracted:facts.reportingPeriods,emissionsReportingPeriod:facts.emissionsReportingPeriods,
    status:metadata.issues.some(i=>/reportingPeriod/i.test(i.field)) ? "requires_human_confirmation" : "requires_verification"};
  report.structuredFacts=facts;
  report.metricsAndTargets.greenhouseGasEmissions.structuredValues=emissionData;
  for(const key of ["scope1","scope3"])Object.assign(report.metricsAndTargets.greenhouseGasEmissions[key],{value:emissionData[key].value,unit:emissionData[key].unit,observations:emissionData[key].observations});
  report.metricsAndTargets.greenhouseGasEmissions.scope2.locationBased=emissionData.scope2LocationBased;
  report.metricsAndTargets.greenhouseGasEmissions.scope2.marketBased=emissionData.scope2MarketBased;
  report.metricsAndTargets.extractedTargets=facts.targets;
  const temps=[...new Set(facts.scenarioTemperatures.map(s=>s.value))];
  Object.assign(report.strategy.scenarioAnalysis,{scenarios:facts.scenarios,temperatures:temps,socioeconomicPathways:facts.socioeconomicPathways,
    modelProvider:facts.modelProvider,dataSources:facts.dataSources,assumptions:facts.assumptions,results:facts.results,
    australianScenarioScreen:{has1_5C:temps.length ? temps.some(t=>Math.abs(t-1.5)<0.001) : null,
      hasAbove2C:temps.length ? temps.some(t=>t>2) : null,
      appearsToAddressAustralianScenarioRequirement:temps.some(t=>Math.abs(t-1.5)<0.001) && temps.some(t=>t>2) ? "requires_human_judgement" : temps.length ? false : null,
      note:"Above 2°C is a screening flag only. Whether a pathway is well above 2°C, its likelihood and Australian applicability require professional review."}});
  report.generalRequirements.transitionReliefs.extracted=facts.adoption;
  Object.assign(report.generalRequirements.transitionReliefs,criteria.find(c=>c.key==="transitionReliefs"));
  report.generalRequirements.transitionReliefs.metadata.basis="Explicit configuration and source evidence reconciled; eligibility does not imply election.";
  Object.assign(report.assuranceReadiness,{externalAssuranceEvidenceFound:facts.assuranceProvider.candidates.length>0 || facts.reviewedAreas.candidates.length>0 || facts.auditedAreas.candidates.length>0,
    provider:facts.assuranceProvider,framework:facts.assuranceFramework,reviewedAreas:facts.reviewedAreas,auditedAreas:facts.auditedAreas,
    levels:facts.assuranceLevels,sourceConclusion:facts.assuranceConclusion,requiresHumanVerification:true,providedByApplication:false});
  report.consistencyIssues=metadata.issues;
  report.reportIntegrity={status:"requires_review",
    consistencyIssues:metadata.issues,metadataConflicts:metadata.issues.filter(i=>i.severity==="high"),unresolvedJudgements:[...unresolved,
      {field:"reportingApplicability",reason:"Professional confirmation required; separate from disclosure completeness."},
      {field:"externalAssurance",reason:"Source assurance scope and applicability require human verification."}],evidenceValidationIssues:[]};
  report.readinessConfidence=report.reportIntegrity.status==="requires_review" ? "requires_review" : "high";
  report.missingDisclosures=criteria.filter(c=>c.missingElements.length && c.completenessStatus!=="not_applicable")
    .map(c=>({criterionId:c.id,status:c.status,completenessStatus:c.completenessStatus,requiredInformation:c.requiredInformation,missingElements:c.missingElements}));
  report.completionActions=[
    action("Confirm reporting applicability and cohort","Reporting applicability",[],["Review entity type, Chapter 2M, NGER and size inputs; obtain professional confirmation."],"high"),
    action("Verify materiality, estimates and evidence interpretation","D17-D19,D74-D82",[],["Review assumptions, uncertain estimates and evidence sufficiency."]),
    action("Verify assurance scope and applicable engagement","External assurance",facts.assuranceProvider.evidenceIds,["Have the responsible practitioner verify coverage, level and timetable."]),
    action("Director approval and statutory declaration","Statutory directors' declaration",[],["Obtain director review and approval; prepare the separate statutory declaration."]),
    action("Complete lodgement process","ASIC lodgement",[],["Complete the applicable external filing process after required approvals."]),
    ...metadata.issues.map(i=>action(i.field,"AASB S2 metadata / Appendix D",i.evidenceIds,[i.action],i.severity)),
  ];
  if(metadata.standard.version==="unknown_requires_confirmation")report.completionActions.push(action("Confirm applicable standard version","C1-C2",[],["Confirm period start and amendment adoption before selecting a version."],"high"));
  if(metadata.effective.firstAnnualPeriodApplyingAasbS2===null || metadata.effective.useComparativesFirstYearRelief===null || metadata.effective.useScope3FirstYearRelief===null)
    report.completionActions.push(action("Confirm transition-relief elections and eligibility","C3-C5",facts.adoption.firstYearOfApplication.evidenceIds,["Confirm first-year application and each elected or non-elected relief explicitly."]));
  report.priorityActions=[...report.completionActions,...criteria.filter(c=>!["complete","not_applicable"].includes(c.completenessStatus))
    .map(c=>({...action(c.description,c.reference,c.evidenceIds,c.requiredInformation.length ? c.requiredInformation : ["Verify substantive sufficiency and professional judgements."]),criterionId:c.id}))];
  Object.assign(report.executiveSummary,{presentCriteria:criteria.filter(c=>c.completenessStatus==="complete").length,
    criteriaRequiringAction:criteria.filter(c=>!["complete","not_applicable"].includes(c.completenessStatus)).length,
    completionActionCount:report.completionActions.length,consistencyIssueCount:metadata.issues.length});
  Object.assign(report.methodology,{version:"aasb-readiness-2",weights:completenessWeights,rawScore,scoreCaps:caps,
    scoreMeaning:"Completeness of extracted requirement elements; not legal compliance or ESG performance",humanInputs:metadata.configured});
  for(const section of sections)report[section].overallStatus=report[section].criteria.every(c=>c.status==="present") ? "present" : report[section].criteria.every(c=>c.status==="missing") ? "missing" : "partial";
  for(const key of ["risksAndOpportunities","businessModelAndValueChain","strategyAndDecisionMaking","financialEffects"]) {
    const group=report.strategy[key];group.overallStatus=group.criteria.every(c=>c.status==="present") ? "present" : group.criteria.every(c=>c.status==="missing") ? "missing" : "partial";
  }
  return report;
}
