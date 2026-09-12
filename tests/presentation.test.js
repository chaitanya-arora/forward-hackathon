import test from "node:test";
import assert from "node:assert/strict";
import { buildAasbPresentation, buildEsgPresentation, attachPresentation } from "../src/reports/presentation.js";
import { buildAasbS2Report } from "../src/aasb/generateAasbS2Report.js";
import { buildReport } from "../src/agent2/generateESGReport.js";
import { normalizeEvidence } from "../src/agent2/normalizeEvidence.js";
import { aasbRubric } from "../src/aasb/rubric.js";
import { rubric } from "../src/agent2/rubric.js";

const sections=["governance","strategy","riskManagement","metricsAndTargets","generalRequirements"];
const input=normalizeEvidence({company:"Contract fixture",report_year:"2026",evidence:[{text:"The council reviews climate risks quarterly.",sourceType:"public"}]});
const missingAasb=()=>({assessments:aasbRubric.map(r=>({criterionId:r.id,status:"missing",citations:[]}))});
const missingEsg=()=>({assessments:rubric.map(r=>({criterionId:r.id,status:"missing",citations:[],potentialInconsistency:false}))});
function noVisualFields(value) {
  if(!value || typeof value!=="object")return;
  for(const [key,item] of Object.entries(value)) {
    assert.ok(!["status","color","colour","icon","iconName","className","cssClass","emoji"].includes(key),key);
    noVisualFields(item);
  }
}
function freeze(value) {if(value && typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test("both complete JSON contracts carry additive presentation and unchanged detailed scores",()=>{
  const aasb=buildAasbS2Report(input,missingAasb());
  const esg=buildReport(input,missingEsg());
  for(const report of [aasb,esg]) {
    assert.equal(report.schemaVersion,"2.0");assert.equal(report.company,"Contract fixture");
    assert.equal(report.reporting.periodStart,null);assert.equal(report.reporting.periodEnd,null);
    const p=report.presentation;
    assert.deepEqual(Object.keys(p),["executiveSummary","keyFindings","priorityActions"]);
    assert.equal(p.executiveSummary.readinessScore,report.aasbS2ReadinessScore ?? report.overallESGReadinessScore);
    assert.equal(p.executiveSummary.readinessLabel,"Readiness");
    assert.ok(p.executiveSummary.headline);assert.ok(p.executiveSummary.summary);assert.equal(p.executiveSummary.requiresHumanReview,true);
    assert.ok(p.keyFindings.length>=3 && p.keyFindings.length<=6);
    noVisualFields(p);
    const {presentation,schemaVersion,reporting,...detailed}=report;
    const before=structuredClone(detailed);
    const rebuilt=attachPresentation(freeze(detailed));
    const {presentation:p2,schemaVersion:s2,reporting:r2,...after}=rebuilt;
    assert.deepEqual(after,before);assert.deepEqual(p2,p);
  }
  assert.equal(aasb.aasbS2ReadinessScore,1);assert.equal(esg.overallESGReadinessScore,0);
  assert.equal(aasb.governance.criteria.length,9);assert.deepEqual(aasb.evidenceRegister,input.evidence);
  assert.ok(aasb.structuredFacts);assert.ok(aasb.reportIntegrity);assert.ok(aasb.completionActions);
  assert.equal(aasb.directorsDeclaration.generatedOrApprovedBySystem,false);assert.equal(aasb.lodgement.lodgementReady,false);
  assert.equal(esg.aasbS2,undefined);assert.equal(esg.reporting.standard,null);
  assert.doesNotMatch(JSON.stringify(esg.presentation),/AASB|ASIC|director|lodgement/);
});

test("negative findings and integrity issues cannot be crowded out by strengths or rubric order",()=>{
  const report=buildAasbS2Report(input,missingAasb());
  report.consistencyIssues=[{field:"reportingPeriodEnd",severity:"high",evidenceIds:["e1"],action:"Confirm the authoritative end date."}];
  const last=report.generalRequirements.criteria.at(-1);
  last.completenessStatus="complete";last.missingElements=[];last.evidenceIds=["e1"];
  const p=buildAasbPresentation(report);
  assert.ok(p.keyFindings.length<=6);assert.ok(p.keyFindings[0].title.includes("gaps"));
  assert.ok(p.keyFindings.some(f=>f.title.includes("differs from source")));
  assert.ok(p.executiveSummary.summary.includes("differs from source"));
  for(const f of p.keyFindings)assert.ok(f.evidenceIds.every(id=>input.evidence.some(e=>e.id===id)));
  assert.ok(p.priorityActions.some(a=>a.actionType==="resolve_conflict" && a.description==="Confirm the authoritative end date."));
  assert.ok(p.priorityActions.every(a=>!p.keyFindings.some(f=>f.title===a.title || f.summary===a.description)));
});

test("priority ranking, deduplication and stable tie order depend only on existing state",()=>{
  const report={reportType:"AASB_S2_DRAFT",aasbS2ReadinessScore:null,completionActions:[
    {issue:"Second",severity:"low",action:"Perform second task."},
    {issue:"First",severity:"high",action:"Perform first task."},
    {issue:"Middle",severity:"medium",action:"Perform middle task."},
    {issue:"Alpha",severity:"high",action:"Perform alpha task."},
  ],consistencyIssues:[{field:"reportingPeriodStart",severity:"high",action:"Resolve the date discrepancy."}]};
  const p=buildAasbPresentation(report);
  assert.equal(p.executiveSummary.readinessScore,null);
  assert.deepEqual(p.priorityActions.map(a=>a.priority),["critical","high","high","medium","low"]);
  assert.deepEqual(p.priorityActions.slice(1,3).map(a=>a.title),["Alpha","First"]);
  const reversed={...report,completionActions:[...report.completionActions].reverse(),priorityActions:[...report.completionActions]};
  assert.deepEqual(buildAasbPresentation(reversed),p);
  assert.deepEqual(buildAasbPresentation({aasbS2ReadinessScore:null}).priorityActions,[]);
  assert.deepEqual(buildEsgPresentation({overallESGReadinessScore:null}).priorityActions,[]);
});

test("ESG conflicts lead to observations and distinct actions without regulatory claims",()=>{
  const data=normalizeEvidence({company:"ESG fixture",evidence:[{text:"The safety committee meets monthly.",sourceType:"public"},{text:"The safety committee did not meet this year.",sourceType:"internal"}]});
  const assessments=missingEsg();
  assessments.assessments[4]={criterionId:"social.safety",status:"strong",potentialInconsistency:true,
    citations:data.evidence.map(e=>({evidenceId:e.id,quote:e.text}))};
  const report=buildReport(data,assessments),p=report.presentation;
  assert.ok(p.keyFindings.some(f=>f.title==="Public and internal evidence may conflict"));
  assert.equal(p.priorityActions[0].actionType,"resolve_conflict");assert.equal(p.priorityActions[0].priority,"critical");
  assert.deepEqual(p.priorityActions[0].evidenceIds,["e1","e2"]);
  assert.equal(p.executiveSummary.readinessScore,report.overallESGReadinessScore);
  noVisualFields(p);
});

test("presentation does not mutate its input or call network and deterministically reassembles",()=>{
  const report=freeze(buildAasbS2Report(input,missingAasb()));
  // The adapter has no model client, SDK or requester dependency; guard accidental fetch.
  const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error("Presentation must not use network");};
  try {assert.deepEqual(buildAasbPresentation(report),report.presentation);} finally {globalThis.fetch=previous;}
  const before=report.aasbS2ReadinessScore;
  for(const section of sections)assert.ok(report[section].criteria);
  assert.equal(report.aasbS2ReadinessScore,before);
});
