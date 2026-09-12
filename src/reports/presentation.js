// Pure presentation adapters: consume validated report state, never request AI
// output, mutate detailed reports, recalculate readiness, or assign visual styles.
const aasbSections = ["governance", "strategy", "riskManagement", "metricsAndTargets", "generalRequirements"];
const esgSections = ["environmental", "social", "governance"];
const names = { governance: "Governance", strategy: "Strategy", riskManagement: "Risk management",
  metricsAndTargets: "Metrics and targets", generalRequirements: "General requirements", environmental: "Environmental", social: "Social" };
const rank = { critical: 0, high: 1, medium: 2, low: 3 };
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const unique = values => [...new Set(values.filter(v => typeof v === "string" && v.length))].sort(cmp);
const criteria = (report, sections) => sections.flatMap(section => (report[section]?.criteria ?? []).map(c => ({ ...c, section })));
const refs = items => unique(items.map(c => c.reference));
const ids = items => unique(items.flatMap(c => [...(c.evidenceIds ?? []), ...(c.citations ?? []).map(q => q.evidenceId)]));
function validIds(report, sections, values) {
  const known = new Set([...(report.evidenceRegister ?? []), ...sections.flatMap(s => report[s]?.evidence ?? [])].map(e => e.id));
  return unique(values).filter(id => known.has(id));
}
const fieldName = field => ({ reportingPeriodStart:"reporting-period start", reportingPeriodEnd:"reporting-period end",
  reportingPeriod:"reporting period", emissionsReportingPeriod:"emissions reporting period",
  earlyAdoptionOf2025Amendments:"amendment adoption", firstAnnualPeriodApplyingAasbS2:"first-year application",
  useComparativesFirstYearRelief:"comparative relief election", useScope3FirstYearRelief:"Scope 3 relief election",
  transitionReliefs:"transition reliefs", "assurance.provider":"assurance provider", "assurance.level":"assurance level", "assurance.scope":"assurance scope" })[field] ?? "reporting metadata";

function finishFindings(report, sections, candidates) {
  const sorted = candidates.sort((a,b) => a.order-b.order || b.count-a.count || cmp(a.key,b.key));
  const selected = sorted.slice(0,6);
  // Do not crowd an integrity conflict out with several section-level gaps.
  const conflict = sorted.find(c => c.key === "integrity-conflicts");
  if (conflict && !selected.includes(conflict)) selected[selected.length-1] = conflict;
  return selected.sort((a,b) => a.order-b.order || b.count-a.count || cmp(a.key,b.key))
    .map(({order,count,key,...finding},i) => ({ id:`kf-${i+1}`, ...finding,
      evidenceIds:validIds(report,sections,finding.evidenceIds) }));
}

export function selectAasbKeyFindings(report) {
  const all = criteria(report,aasbSections), candidates = [];
  for (const section of aasbSections) {
    const items = all.filter(c => c.section===section);
    const gaps = items.filter(c => c.completenessStatus!=="not_applicable" &&
      (c.missingElements?.length || ["missing","partial"].includes(c.completenessStatus)));
    if (gaps.length) candidates.push({ key:`gap-${section}`,order:0,count:gaps.length,importance:"high",
      title:`${names[section]}: disclosure evidence gaps`,
      summary:`${gaps.length} of ${items.length} assessments in this area have missing or incomplete information in the supplied evidence.`,
      section,references:refs(gaps),evidenceIds:ids(gaps) });
    const supported = items.filter(c => ["complete","evidence_found_requires_judgement"].includes(c.completenessStatus));
    if (supported.length) candidates.push({key:`strength-${section}`,order:3,count:supported.length,importance:"medium",
      title:`${names[section]} contains supported disclosures`,
      summary:`${supported.length} assessments have all listed information elements supported; ${supported.filter(c=>c.completenessStatus==="complete").length} are classified complete and the remainder require judgement.`,
      section,references:refs(supported),evidenceIds:ids(supported)});
  }
  const unresolved=all.filter(c=>["requires_human_confirmation","evidence_found_requires_judgement"].includes(c.completenessStatus));
  if(unresolved.length)candidates.push({key:"judgements",order:1,count:unresolved.length,importance:"high",
    title:"Assessment decisions remain unresolved",summary:`${unresolved.length} assessments depend on confirmation or professional interpretation.`,
    section:"generalRequirements",references:refs(unresolved),evidenceIds:ids(unresolved)});
  const conflicts=report.consistencyIssues ?? report.reportIntegrity?.consistencyIssues ?? [];
  if(conflicts.length)candidates.push({key:"integrity-conflicts",order:2,count:conflicts.length,importance:"high",
    title:"Reporting metadata differs from source evidence",summary:`Recorded consistency issues concern ${unique(conflicts.map(c=>fieldName(c.field))).join(", ")}.`,
    section:"generalRequirements",references:[],evidenceIds:ids(conflicts)});
  for(const scope of ["scope1","scope3"]) {
    const fact=report.metricsAndTargets?.greenhouseGasEmissions?.structuredValues?.[scope];
    if(Number.isFinite(fact?.value) && fact.unit)candidates.push({key:`fact-${scope}`,order:4,count:1,importance:"medium",
      title:`${scope==="scope1" ? "Scope 1" : "Scope 3"} emissions have a structured value`,
      summary:`The extracted value is ${fact.value} ${fact.unit}; its period, boundary and interpretation remain subject to the detailed assessment.`,
      section:"metricsAndTargets",references:["29(a)(i)"],evidenceIds:fact.evidenceIds ?? []});
  }
  return finishFindings(report,aasbSections,candidates);
}

export function selectEsgKeyFindings(report) {
  const all=criteria(report,esgSections),candidates=[];
  for(const section of esgSections) {
    const items=all.filter(c=>c.section===section);
    const gaps=items.filter(c=>["missing","partial"].includes(c.status) || c.gapType);
    if(gaps.length)candidates.push({key:`gap-${section}`,order:0,count:gaps.length,importance:"high",
      title:`${names[section]} evidence needs further support`,
      summary:`${gaps.length} of ${items.length} assessments have evidence gaps or disclosure issues; this does not establish absent company practices.`,
      section,references:[],evidenceIds:ids(gaps)});
    const strengths=items.filter(c=>c.status==="strong" && !c.gapType);
    if(strengths.length)candidates.push({key:`strength-${section}`,order:3,count:strengths.length,importance:"medium",
      title:`${names[section]} has strong supporting evidence`,summary:`${strengths.length} assessments have strong support in the uploaded evidence; this describes evidence readiness, not company performance.`,
      section,references:[],evidenceIds:ids(strengths)});
  }
  const conflicts=all.filter(c=>c.gapType==="potential_inconsistency");
  if(conflicts.length)candidates.push({key:"integrity-conflicts",order:2,count:conflicts.length,importance:"high",
    title:"Public and internal evidence may conflict",summary:`${conflicts.length} assessments flag potential inconsistencies between their cited public and internal sources.`,
    section:conflicts.length===1 ? conflicts[0].section : "general",references:[],evidenceIds:ids(conflicts)});
  return finishFindings(report,esgSections,candidates);
}

function finishActions(report, sections, candidates) {
  const seen = new Set();
  return candidates.filter(a=>a.description && !seen.has(a.key) && seen.add(a.key))
    .sort((a,b)=>rank[a.priority]-rank[b.priority] || cmp(a.key,b.key))
    .map(({key,...a},i)=>({id:`pa-${i+1}`,...a,evidenceIds:validIds(report,sections,a.evidenceIds)}));
}
function actionType(text) {
  if(/director|declaration/i.test(text))return "director_action";
  if(/assurance/i.test(text))return "external_assurance";
  if(/conflict|inconsisten|discrepan/i.test(text))return "resolve_conflict";
  if(/confirm|period|version|adoption|relief|cohort|applicab/i.test(text))return "human_confirmation";
  return "professional_judgement";
}
export function buildAasbPriorityActions(report) {
  const all=criteria(report,aasbSections),candidates=[];
  const conflicts=report.consistencyIssues ?? report.reportIntegrity?.consistencyIssues ?? [];
  for(const issue of conflicts)candidates.push({key:`conflict-${issue.field}`,priority:issue.severity==="high" ? "critical" : "high",
    title:`Resolve ${fieldName(issue.field)} discrepancy`,description:issue.action,
    section:"generalRequirements",reference:null,actionType:"resolve_conflict",evidenceIds:issue.evidenceIds ?? []});
  for(const c of all) {
    if(["complete","not_applicable"].includes(c.completenessStatus))continue;
    const gap=(report.missingDisclosures ?? []).find(g=>g.criterionId===c.id);
    const needed=gap?.requiredInformation ?? c.requiredInformation ?? [];
    // Render internal element identifiers as words without altering stored detail.
    const information=needed.map(text=>(c.missingElements ?? []).reduce((result,key)=>
      result.split(key).join(key.replace(/([a-z0-9])([A-Z])/g,"$1 $2").toLowerCase()),text)).join(" ");
    const description=needed.length ? information : c.requiresHumanJudgement || c.status==="requires_human_judgement" ? `Review the substantive interpretation of ${c.description}.` : null;
    if(!description)continue;
    const confirm=c.completenessStatus==="requires_human_confirmation";
    candidates.push({key:`criterion-${c.id}`,priority:c.completenessStatus==="missing" || confirm ? "high" : "medium",
      title:`${confirm ? "Confirm" : needed.length ? "Provide supporting information for" : "Review"} ${c.description}`,
      description,section:c.section,reference:c.reference ?? null,
      actionType:confirm ? "human_confirmation" : needed.length ? "provide_evidence" : "professional_judgement",evidenceIds:ids([c])});
  }
  for(const a of [...(report.completionActions ?? []),...(report.priorityActions ?? [])]) {
    if(a.criterionId && all.some(c=>c.id===a.criterionId))continue;
    if(conflicts.some(c=>c.field===a.issue))continue;
    const description=a.recommendedNextStep ?? a.requiredAction ?? a.action;
    const title=a.issue ?? a.title;
    if(!title || !description)continue;
    candidates.push({key:`process-${title}`,priority:Object.hasOwn(rank,a.severity) ? a.severity : "medium",title,description,
      section:a.section ?? "generalRequirements",reference:a.reference ?? null,actionType:actionType(title),evidenceIds:a.evidenceIds ?? a.currentEvidence ?? []});
  }
  return finishActions(report,aasbSections,candidates);
}

export function buildEsgPriorityActions(report) {
  const all=criteria(report,esgSections);
  return finishActions(report,esgSections,(report.priorityActions ?? []).flatMap(a=>{
    const c=all.find(c=>c.id===a.criterionId);
    if(!c || !a.action)return [];
    const conflict=c.gapType==="potential_inconsistency";
    return [{key:`criterion-${c.id}`,priority:conflict ? "critical" : c.status==="missing" ? "high" : "medium",
      title:`${conflict ? "Reconcile evidence for" : c.gapType==="disclosure_gap" ? "Review public disclosure of" : "Strengthen evidence for"} ${c.description}`,
      description:a.action,section:c.section,reference:null,
      actionType:conflict ? "resolve_conflict" : c.gapType==="disclosure_gap" ? "human_confirmation" : "provide_evidence",evidenceIds:ids([c])}];
  }));
}

function executiveSummary(report, aasb, findings, actions) {
  const sections=aasb ? aasbSections : esgSections;
  const score=(aasb ? report.aasbS2ReadinessScore : report.overallESGReadinessScore) ?? null;
  const strongest=sections.map(section=>({section,count:(report[section]?.criteria ?? []).filter(c=>aasb
    ? ["complete","evidence_found_requires_judgement"].includes(c.completenessStatus) : c.status==="strong" && !c.gapType).length,
    total:(report[section]?.criteria ?? []).filter(c=>c.completenessStatus!=="not_applicable").length}))
    .filter(s=>s.count>0 && s.total>0).sort((a,b)=>b.count/b.total-a.count/a.total || cmp(a.section,b.section)).slice(0,2);
  const negative=findings.filter(f=>f.importance==="high");
  const headline=score===null ? "Readiness score is unavailable" : negative.length ? "Evidence readiness has unresolved gaps or review matters" : "Evidence readiness is available for human review";
  const sentences=[score===null ? "The report has no numeric readiness result for the included assessments." : `The internal evidence-readiness score is ${score}/100.`];
  sentences.push(strongest.length ? `${strongest.map(s=>names[s.section]).join(" and ")} have the largest proportions of ${aasb ? "complete or judgement-dependent" : "strongly supported"} assessments.`
    : `No area has ${aasb ? "complete or fully supported" : "strongly supported"} assessments without remaining evidence limitations.`);
  if(negative.length) {
    const conflicts=negative.filter(f=>/differs from source|may conflict/.test(f.title));
    const important=[...conflicts,...negative.filter(f=>!conflicts.includes(f))].slice(0,2);
    sentences.push(`${important.map(f=>f.title).join("; ")}.`);
  }
  const external=actions.filter(a=>["director_action","external_assurance","professional_judgement","human_confirmation","resolve_conflict"].includes(a.actionType));
  sentences.push(aasb ? (external.length ? "Reporting decisions and applicable external review, assurance and director processes remain for human completion." : "This remains a draft for human interpretation and applicable external reporting processes.")
    : "Evidence interpretation and any outstanding disclosure actions require human review; the score does not measure company ESG performance.");
  return {readinessScore:score,readinessLabel:"Readiness",scoreDisclaimer:aasb ? "Internal evidence-readiness measure; not percentage compliance." : "Internal evidence-readiness measure; not company ESG performance.",
    headline,summary:sentences.join(" "),requiresHumanReview:true};
}
export function buildAasbExecutiveSummary(report) {return executiveSummary(report,true,selectAasbKeyFindings(report),buildAasbPriorityActions(report));}
export function buildEsgExecutiveSummary(report) {return executiveSummary(report,false,selectEsgKeyFindings(report),buildEsgPriorityActions(report));}
export function buildAasbPresentation(report) {
  const keyFindings=selectAasbKeyFindings(report),priorityActions=buildAasbPriorityActions(report);
  return {executiveSummary:executiveSummary(report,true,keyFindings,priorityActions),keyFindings,priorityActions};
}
export function buildEsgPresentation(report) {
  const keyFindings=selectEsgKeyFindings(report),priorityActions=buildEsgPriorityActions(report);
  return {executiveSummary:executiveSummary(report,false,keyFindings,priorityActions),keyFindings,priorityActions};
}
export function attachPresentation(report) {
  if(!["AASB_S2_DRAFT","ESG_READINESS"].includes(report.reportType))throw new TypeError("Unsupported presentation report type.");
  const aasb=report.reportType==="AASB_S2_DRAFT";
  const year=report.reportingPeriod?.year ?? report.reportYear ?? null;
  return {...report,schemaVersion:"2.0",reporting:{year:year===null ? null : String(year),
    periodStart:report.reportingPeriod?.startDate ?? null,periodEnd:report.reportingPeriod?.endDate ?? null,
    standard:aasb ? report.standard?.name ?? null : null,standardVersion:aasb && report.standard?.version!=="unknown_requires_confirmation" ? report.standard?.version ?? null : null},
    presentation:aasb ? buildAasbPresentation(report) : buildEsgPresentation(report)};
}
