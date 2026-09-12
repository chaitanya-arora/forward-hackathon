import test from "node:test";
import assert from "node:assert/strict";
import { aasbRubric } from "../src/aasb/rubric.js";
import { prepareContext, resolveStandard, assessApplicability } from "../src/aasb/context.js";
import { buildAasbS2Report, generateAasbS2Report } from "../src/aasb/generateAasbS2Report.js";
import { normalizeEvidence } from "../src/agent2/normalizeEvidence.js";

const quote = "The board reviews climate risks quarterly.";
const raw = { company: "Fixture", report_year: "2025", evidence: [{ text: quote, documentId: 4, source: "board.pdf", sourceType: "internal", pages: [2], confidence: 0.95 }] };
const input = normalizeEvidence(raw);
const missing = () => ({ assessments: aasbRubric.map(r => ({ criterionId: r.id, status: "missing", citations: [] })) });
const supported = () => {
  const result = missing();
  result.assessments[0] = { criterionId: aasbRubric[0].id, status: "present", citations: [{ evidenceId: "e1", quote }] };
  return result;
};


test("AASB draft has granular sections, explicit human processes and no invented evidence", async () => {
  const report = await generateAasbS2Report({ company: "Empty", evidence: [] });
  assert.equal(report.reportType, "AASB_S2_DRAFT");
  assert.equal(report.priority, "primary");
  assert.equal(report.status, "draft_for_management_director_and_assurance_review");
  assert.equal(report.aasbS2ReadinessScore, 0);
  for (const section of ["governance","strategy","riskManagement","metricsAndTargets","generalRequirements"]) assert.ok(report[section].criteria.length > 4);
  assert.equal(report.strategy.scenarioAnalysis.status, "missing");
  assert.equal(report.metricsAndTargets.greenhouseGasEmissions.scope1.status, "missing");
  assert.equal(report.missingDisclosures.length, aasbRubric.length);
  assert.equal(report.standard.version, "unknown_requires_confirmation");
  assert.equal(report.reportingApplicability.assessment, "unknown");
  assert.equal(report.generalRequirements.transitionReliefs.metadata.transitionReliefStatus, "unknown_requires_confirmation");
  assert.equal(report.directorsDeclaration.generatedOrApprovedBySystem, false);
  assert.equal(report.lodgement.lodgementReady, false);
  assert.equal(report.assuranceReadiness.status, "requires_external_assurance_review");
});

test("exact citations preserve document identity and unsupported positives cannot score", () => {
  const report = buildAasbS2Report(input, supported(), { reportingPeriodStart: "2025-01-01" });
  assert.deepEqual(report.evidenceRegister[0].pages, [2]);
  assert.equal(report.evidenceRegister[0].documentId, 4);
  assert.equal(report.evidenceRegister[0].source, "board.pdf");
  assert.equal(report.governance.criteria[0].citations[0].quote, quote);
  const result = supported();
  result.assessments[0].citations = [];
  assert.equal(buildAasbS2Report(input,result).governance.criteria[0].status,"missing");
  result.assessments[0].status = "not_applicable";
  assert.equal(buildAasbS2Report(input,result).governance.criteria[0].status,"requires_human_judgement");
  assert.equal(buildAasbS2Report(input,result).aasbS2ReadinessScore,0);
});

test("invalid IDs, quotations, omitted criteria and duplicate criteria fail closed", () => {
  for (const alter of [r => { r.assessments[0].citations[0].evidenceId="fake"; },
    r => { r.assessments[0].citations[0].quote="Invented emissions were 1234 tonnes."; },
    r => { r.assessments.pop(); }, r => { r.assessments.push(r.assessments[0]); }]) {
    const result=supported(); alter(result);
    assert.throws(()=>buildAasbS2Report(input,result));
  }
});

test("versions use reporting start dates, validate dates and respect explicit early adoption", () => {
  const select = c => resolveStandard(prepareContext(c)).version;
  assert.equal(select({reportingPeriodStart:"2025-01-01"}),"2024-09");
  assert.equal(select({reportingPeriodStart:"2026-12-31"}),"2024-09");
  assert.equal(select({reportingPeriodStart:"2027-01-01"}),"2025-12");
  assert.equal(select({reportingPeriodStart:"2025-07-01",earlyAdoptionOf2025Amendments:true}),"2025-12");
  assert.equal(select({reportingPeriodStart:"2024-07-01"}),"unknown_requires_confirmation");
  assert.equal(select({earlyAdoptionOf2025Amendments:true}),"unknown_requires_confirmation");
  assert.throws(()=>prepareContext({reportingPeriodStart:"2025-02-30"}));
  assert.throws(()=>prepareContext({reportingPeriodStart:"2025-01-01",reportingPeriodEnd:"2024-12-31"}));
  assert.throws(()=>prepareContext({firstAnnualPeriodApplyingAasbS2:"true"}));
});

test("transition reliefs require inputs and model cannot silently apply them", () => {
  const base={reportingPeriodStart:"2025-01-01"};
  const unknown=buildAasbS2Report(input,missing(),base);
  assert.equal(unknown.generalRequirements.comparatives.status,"missing");
  const first=buildAasbS2Report(input,missing(),{...base,firstAnnualPeriodApplyingAasbS2:true});
  assert.equal(first.generalRequirements.comparatives.status,"not_applicable");
  assert.equal(first.metricsAndTargets.greenhouseGasEmissions.scope3.status,"missing");
  const elected=buildAasbS2Report(input,missing(),{...base,firstAnnualPeriodApplyingAasbS2:true,useScope3FirstYearRelief:true});
  assert.equal(elected.metricsAndTargets.greenhouseGasEmissions.scope3.status,"not_applicable");
  assert.equal(elected.aasbS2ReadinessScore,0);
  assert.throws(()=>prepareContext({firstAnnualPeriodApplyingAasbS2:false,useScope3FirstYearRelief:true}));
  const manual=buildAasbS2Report(input,missing(),{ confirmedNotApplicable: {"strategy.transitionPlan":{reason:"Reviewed by management",confirmedBy:"Reviewer"}} });
  assert.equal(manual.strategy.transitionPlan.status,"not_applicable");
  assert.equal(manual.strategy.transitionPlan.applicabilityBasis.confirmedBy,"Reviewer");
});

test("size hints are conditional, include unassessed tests, and never decide legal obligation", () => {
  const assess=c=>assessApplicability(prepareContext(c));
  assert.equal(assess({}).assessment,"unknown");
  assert.equal(assess({companySize:{revenueAud:500e6,employees:500}}).assessment,"likely_group_1");
  const group2=assess({companySize:{revenueAud:200e6,assetsAud:500e6,employees:100},reportingPeriodStart:"2026-01-01"});
  assert.equal(group2.assessment,"likely_group_2");
  assert.equal(group2.periodTiming,"before_group_commencement");
  assert.equal(group2.legallyRequired,undefined);
  assert.equal(group2.requiresProfessionalConfirmation,true);
  assert.equal(group2.otherTestsNotAssessed.length,3);
  assert.equal(assess({companySize:{revenueAud:50e6,assetsAud:25e6,employees:1}}).assessment,"likely_group_3");
});

test("AASB generator validates model JSON and uses the complete rubric", async () => {
  const client={models:{async generateContent(request){
    assert.equal(JSON.parse(request.contents).rubric.length,aasbRubric.length);
    assert.equal(request.config.responseMimeType,"application/json");
    const result = supported(); result.assessments[0].citations = [{excerptId:"e1_1"}];
    return {text:JSON.stringify(result)};
  }}};
  const report=await generateAasbS2Report(raw,{reportingPeriodStart:"2025-01-01"},{client});
  assert.equal(report.standard.version,"2024-09");
  await assert.rejects(generateAasbS2Report(raw,{}, {client:{models:{async generateContent(){return {text:"oops"};}}}}), /invalid/);
});
