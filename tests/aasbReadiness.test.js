import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeEvidence } from "../src/agent2/normalizeEvidence.js";
import { aasbRubric } from "../src/aasb/rubric.js";
import { requirementFor } from "../src/aasb/requirements.js";
import { extractStructuredFacts } from "../src/aasb/extractFacts.js";
import { buildAasbS2Report, generateAasbS2Report } from "../src/aasb/generateAasbS2Report.js";

const fixture = name => normalizeEvidence(JSON.parse(readFileSync(new URL(`./fixtures/aasb/${name}.json`,import.meta.url))));
const missing = () => ({assessments:aasbRubric.map(r=>({criterionId:r.id,status:"missing",citations:[]}))});
const allRelevant = input => ({assessments:aasbRubric.map(r=>({criterionId:r.id,status:"present",citations:[{evidenceId:input.evidence[0].id,quote:input.evidence[0].text}]}))});
const sections=["governance","strategy","riskManagement","metricsAndTargets","generalRequirements"];

test("generic requirement definitions cover every criterion; topical evidence is not completeness",()=>{
  assert.equal(aasbRubric.every(r=>requirementFor(r).requiredElements.length>=2),true);
  const input=normalizeEvidence({company:"Any Entity",evidence:[{text:"Climate-related matters are important to our organisation."}]});
  const report=buildAasbS2Report(input,allRelevant(input));
  assert.equal(report.governance.criteria[0].completenessStatus,"partial");
  assert.ok(report.aasbS2ReadinessScore<100);
  assert.ok(report.missingDisclosures.length>0);
  assert.ok(report.priorityActions.length>0);
  assert.equal(buildAasbS2Report(input,missing()).strategy.scenarioAnalysis.completenessStatus,"missing");
  assert.equal(report.generalRequirements.transitionReliefs.completenessStatus,"requires_human_confirmation");
});

test("two different companies retain fiscal periods, units, governance, target records and assurance scopes",()=>{
  const a=buildAasbS2Report(fixture("harbour"),missing());
  const b=buildAasbS2Report(fixture("summit"),missing());
  assert.equal(a.reportingPeriod.startDate,"2025-04-01");assert.equal(a.reportingPeriod.endDate,"2026-03-31");
  assert.equal(b.reportingPeriod.startDate,"2026-10-01");assert.equal(b.reportingPeriod.endDate,"2027-09-30");
  assert.equal(a.structuredFacts.governingBody.value,"Trustee Board");assert.equal(b.structuredFacts.governingBody.value,"Supervisory Council");
  const ae=a.metricsAndTargets.greenhouseGasEmissions.structuredValues,be=b.metricsAndTargets.greenhouseGasEmissions.structuredValues;
  assert.equal(ae.scope1.value,12.5);assert.equal(ae.scope1.unit,"ktCO2-e");assert.equal(ae.scope1.normalized.value,12500);
  assert.equal(ae.scope2MarketBased.value,0);assert.equal(ae.scope3.value,0.4);assert.equal(ae.scope3.unit,"MtCO2-e");
  assert.equal(be.scope1.value,84250);assert.equal(be.scope1.unit,"tCO2-e");assert.equal(be.scope3.normalized.value,2300000);
  assert.deepEqual(a.strategy.scenarioAnalysis.temperatures,[1.6,3.8]);assert.deepEqual(b.strategy.scenarioAnalysis.temperatures,[1.5,2.2,4.1]);
  assert.equal(a.strategy.scenarioAnalysis.australianScenarioScreen.appearsToAddressAustralianScenarioRequirement,false);
  assert.equal(b.strategy.scenarioAnalysis.australianScenarioScreen.appearsToAddressAustralianScenarioRequirement,"requires_human_judgement");
  assert.equal(a.metricsAndTargets.extractedTargets[0].value.baselineYear,2021);assert.equal(a.metricsAndTargets.extractedTargets[0].value.targetYear,2034);
  assert.equal(b.metricsAndTargets.extractedTargets[0].value.absoluteOrIntensity,"intensity");assert.equal(b.metricsAndTargets.extractedTargets[0].value.targetYear,2038);
  assert.equal(a.assuranceReadiness.provider.value,"Meridian Verification LLP");assert.equal(b.assuranceReadiness.provider.value,"North Star Audit Partners");
  assert.equal(b.assuranceReadiness.auditedAreas.value,"Scope 1 and Scope 2 emissions");assert.equal(a.assuranceReadiness.reviewedAreas.value,"governance and scenario methods");
  assert.equal(a.assuranceReadiness.providedByApplication,false);
  assert.equal(a.standard.version,"2025-12");assert.equal(a.standard.earlyAmendmentAdoption,true);
  assert.equal(a.generalRequirements.transitionReliefs.extracted.firstYearOfApplication.value,true);
  assert.equal(a.generalRequirements.transitionReliefs.metadata.comparatives.applied,true);
  assert.equal(a.generalRequirements.transitionReliefs.metadata.scope3.applied,false);
  assert.equal(b.generalRequirements.transitionReliefs.extracted.firstYearOfApplication.value,false);
});

test("configuration conflicts do not silently override evidence and cap readiness",()=>{
  const input=fixture("harbour");
  const report=buildAasbS2Report(input,allRelevant(input),{reportingPeriodStart:"2025-01-01",reportingPeriodEnd:"2025-12-31",earlyAdoptionOf2025Amendments:false});
  assert.equal(report.reportingPeriod.startDate,null);
  assert.equal(report.reportingPeriod.configured.startDate,"2025-01-01");
  assert.ok(report.consistencyIssues.some(i=>i.field==="earlyAdoptionOf2025Amendments"));
  assert.equal(report.standard.version,"unknown_requires_confirmation");
  assert.ok(report.aasbS2ReadinessScore<=75);assert.equal(report.reportIntegrity.status,"requires_review");
  assert.equal(report.generalRequirements.reportingPeriod.completenessStatus,"requires_human_confirmation");
  assert.ok(report.priorityActions.some(a=>a.issue==="reportingPeriodStart"));
  assert.ok(buildAasbS2Report(fixture("summit"),missing()).consistencyIssues.some(i=>i.field==="emissionsReportingPeriod"));
});

test("quantitative completeness requires period and boundary, not only a value or model label",()=>{
  const onlyValue=normalizeEvidence({company:"Other",evidence:[{text:"Scope 1 = 17 ktCO2-e."}]});
  assert.equal(buildAasbS2Report(onlyValue,allRelevant(onlyValue)).metricsAndTargets.greenhouseGasEmissions.scope1.completenessStatus,"partial");
  const complete=buildAasbS2Report(fixture("harbour"),missing()).metricsAndTargets.greenhouseGasEmissions.scope1;
  assert.equal(complete.completenessStatus,"complete");assert.deepEqual(complete.missingElements,[]);
});

test("element-level partial and professional judgement remain distinct and hallucinated elements fail",()=>{
  const input=fixture("harbour"),result=missing(),rule=aasbRubric[0];
  const citations=[{evidenceId:input.evidence[1].id,quote:input.evidence[1].text}];
  result.assessments[0]={criterionId:rule.id,status:"present",citations,elements:requirementFor(rule).requiredElements.map(elementId=>({elementId,status:"explicit",citations}))};
  assert.equal(buildAasbS2Report(input,result).governance.criteria[0].completenessStatus,"evidence_found_requires_judgement");
  result.assessments[0].elements[1].status="partial";
  assert.equal(buildAasbS2Report(input,result).governance.criteria[0].completenessStatus,"partial");
  result.assessments[0].elements[1].status="requires_human_confirmation";
  assert.equal(buildAasbS2Report(input,result).governance.criteria[0].completenessStatus,"requires_human_confirmation");
  result.assessments[0].elements[1].citations=[{evidenceId:"fake",quote:"Fabricated content."}];
  assert.throws(()=>buildAasbS2Report(input,result),/Unverifiable/);
});

test("completion actions remain even when all criteria are explicitly excluded; reports never approve filing",()=>{
  const input=normalizeEvidence({company:"Scope fixture",evidence:[]});
  const confirmedNotApplicable=Object.fromEntries(aasbRubric.map(r=>[r.id,{reason:"Synthetic scope test only",confirmedBy:"Fixture reviewer"}]));
  const report=buildAasbS2Report(input,missing(),{confirmedNotApplicable,reportingPeriodStart:"2025-04-01"});
  assert.deepEqual(report.missingDisclosures,[]);assert.ok(report.completionActions.length>=5);
  assert.equal(report.aasbS2ReadinessScore,null);
  assert.equal(report.reportType,"AASB_S2_DRAFT");assert.equal(report.lodgement.lodgementReady,false);
  assert.equal(report.directorsDeclaration.generatedOrApprovedBySystem,false);
});

test("Coles real-source regression uses generic parsers, retains exact source and detects old metadata conflicts",()=>{
  const input=fixture("coles-regression"),facts=extractStructuredFacts(input);
  assert.ok(facts.reportingPeriods.some(p=>p.value.endDate==="2026-06-28" && p.value.startDate==="2025-06-30"));
  assert.ok(facts.emissionsReportingPeriods.some(p=>p.value.startDate==="2025-07-01"));
  assert.equal(facts.adoption.earlyAmendmentAdoption.value,true);assert.equal(facts.adoption.comparativesRelief.value,true);
  assert.ok(facts.emissions.some(e=>e.value.scope===1 && e.value.value===256203));
  assert.ok(facts.emissions.some(e=>e.value.scope===3 && e.value.value===18.98));
  const report=buildAasbS2Report(input,allRelevant(input),{reportingPeriodStart:"2025-01-01",reportingPeriodEnd:"2025-12-31",earlyAdoptionOf2025Amendments:false});
  assert.ok(report.aasbS2ReadinessScore<100);assert.ok(report.consistencyIssues.length>=2);
  assert.deepEqual(report.evidenceRegister,input.evidence);
  for(const c of sections.flatMap(s=>report[s].criteria)) {
    assert.ok(c.citations.every(q=>q.quote.length<=220));
    assert.ok(c.citations.every(q=>input.evidence.find(e=>e.id===q.evidenceId).text.includes(q.quote)));
    assert.ok(c.evidenceIds.every(id=>input.evidence.some(e=>e.id===id)));
  }
});

test("company identity and evidence order do not drive local facts",()=>{
  const input=fixture("summit"),other={...input,company:"Renamed unrelated entity",evidence:[...input.evidence].reverse()};
  const a=extractStructuredFacts(input),b=extractStructuredFacts(other);
  assert.deepEqual(a.emissions.map(e=>e.value),b.emissions.map(e=>e.value));
  assert.equal(a.governingBody.value,b.governingBody.value);
  assert.deepEqual(a.reportingPeriods.map(p=>p.value),b.reportingPeriods.map(p=>p.value));
});

test("richer assessment is one model request with source IDs and no correction requests",async()=>{
  const input=JSON.parse(readFileSync(new URL("./fixtures/aasb/harbour.json",import.meta.url)));
  let calls=0;
  const client={models:{async generateContent(request){calls++;const payload=JSON.parse(request.contents);
    assert.equal(payload.rubric.length,64);assert.ok(payload.rubric.every(r=>r.requiredElements.length>=2));
    const r=missing();r.assessments[0].status="partial";r.assessments[0].citations=[{excerptId:payload.evidence[1].excerpts[0].excerptId}];
    r.assessments[0].elements=[{elementId:"oversightResponsibilities",status:"explicit",citations:[...r.assessments[0].citations]}];
    return {text:JSON.stringify(r)};}}};
  const report=await generateAasbS2Report(input,{}, {client});
  assert.equal(calls,1);assert.equal(report.methodology.version,"aasb-readiness-2");
});

test("permission to early-adopt is not an election; conflicting quantities stay unresolved",()=>{
  const input=normalizeEvidence({company:"Unspecified",report_year:"2032",evidence:[{text:"Early adoption of the December 2025 amendments is permitted. Scope 1 = 12 ktCO2-e. Scope 1 = 15 ktCO2-e."}]});
  const report=buildAasbS2Report(input,missing());
  assert.equal(report.structuredFacts.adoption.earlyAmendmentAdoption.value,null);
  assert.equal(report.reportingPeriod.startDate,null);
  assert.equal(report.metricsAndTargets.greenhouseGasEmissions.scope1.value,null);
  assert.equal(report.metricsAndTargets.greenhouseGasEmissions.scope1.observations.length,2);
  const negative=extractStructuredFacts(normalizeEvidence({company:"Negation fixture",evidence:[{text:"We have not yet early adopted the December 2025 amendments. This is not its first year applying AASB S2."}]}));
  assert.equal(negative.adoption.earlyAmendmentAdoption.value,false);
  assert.equal(negative.adoption.firstYearOfApplication.value,false);
});

test("assurance conflicts are separate review issues and monetary fields retain explicit units",()=>{
  const report=buildAasbS2Report(fixture("harbour"),missing(),{expectedAssurance:{provider:"Different practitioner",level:"reasonable assurance",scope:"all disclosures"}});
  assert.ok(report.consistencyIssues.some(i=>i.field==="assurance.provider"));
  assert.ok(report.consistencyIssues.some(i=>i.field==="assurance.level"));
  assert.equal(report.assuranceReadiness.provider.value,"Meridian Verification LLP");
  const facts=extractStructuredFacts(normalizeEvidence({company:"Quantity fixture",evidence:[{text:"Capital deployment: AUD 3.5 million for climate adaptation; Internal carbon price: USD 62 per tCO2-e; Climate weighting is 14% of executive remuneration."}]}));
  assert.equal(facts.capitalDeployment.value.normalizedAmount,3500000);
  assert.equal(facts.internalCarbonPrice.value.amount,62);
  assert.equal(facts.internalCarbonPrice.value.currency,"USD");
  assert.equal(facts.executiveRemuneration.value.percentage,14);
});
