import { createHash } from "node:crypto";
import { requestGemini } from "./gemini.js";
import { validateCitations } from "../agent2/validateCitations.js";

// Contiguous, bounded source spans. No summarisation or whitespace rewriting.
export function sourceExcerpts(evidence) {
  return evidence.flatMap(source => {
    const spans = [];
    let start = 0;
    while (start < source.text.length) {
      let end = Math.min(start + 1000, source.text.length);
      if (end < source.text.length) {
        const boundary = source.text.lastIndexOf(" ", end);
        if (boundary > start + 500) end = boundary;
      }
      spans.push({ id: `${source.id}:s${spans.length + 1}`, evidenceId: source.id,
        start, end, text: source.text.slice(start, end) });
      start = end;
    }
    return spans;
  });
}

export async function assessByExcerpts(ai, request, input, options = {}) {
  const original = JSON.parse(request.contents);
  const rubric = original.rubric;
  const excerpts = sourceExcerpts(input.evidence);
  const byExcerpt = new Map(excerpts.map(e => [e.id, e]));
  const originalItem = request.config.responseJsonSchema.properties.assessments.items;
  const statuses = originalItem.properties.status.enum;
  const isEsg = Boolean(originalItem.properties.potentialInconsistency);
  const instruction = request.config.systemInstruction + `
Citation protocol: select excerptIds from the supplied source excerpts. Do NOT write quotations or evidenceId fields.
Each excerpt is an exact span of its parent evidence. Select all neighbouring excerpts needed to preserve context and negations.
Assess only the requested criteria. Positive findings need supporting excerptIds; unsupported findings must be missing with an empty array.
Return {"assessments":[{"criterionId":"requested ID","status":"allowed status","excerptIds":["supplied excerpt ID"]${isEsg ? ',"potentialInconsistency":false' : ''}}]}.`;
  const key = createHash("sha256").update(JSON.stringify({version:1,request,input})).digest("hex");
  const accepted = new Map();
  function materialize(item) {
    if (!item || !rubric.some(r => r.id === item.criterionId) || !statuses.includes(item.status)
        || !Array.isArray(item.excerptIds) || new Set(item.excerptIds).size !== item.excerptIds.length
        || (isEsg && typeof item.potentialInconsistency !== "boolean")) throw Error("Invalid excerpt assessment fields.");
    const citations = item.excerptIds.map(id => {
      const span = byExcerpt.get(id);
      if (!span || span.text.trim().length < 12) throw Error("Unknown or insufficient source excerpt.");
      return { evidenceId: span.evidenceId, quote: span.text };
    });
    validateCitations(citations, input, item.criterionId);
    if (["strong","present","partial"].includes(item.status) && !citations.length) throw Error("Positive assessment needs source excerpts.");
    return {criterionId:item.criterionId,status:item.status,citations,
      ...(isEsg ? {potentialInconsistency:item.potentialInconsistency} : {})};
  }
  for (const rule of rubric) {
    const saved = options.assessmentCheckpoint?.get(key, rule.id);
    if (saved) { materialize(saved); accepted.set(rule.id, saved); }
  }
  if (accepted.size) console.error(`Reusing ${accepted.size}/${rubric.length} saved report assessments.`);
  // At most one targeted repair. Valid criteria are saved before another call.
  for (let attempt = 0; attempt < 2 && accepted.size < rubric.length; attempt++) {
    const pending = rubric.filter(r => !accepted.has(r.id));
    const itemSchema = {type:"object",additionalProperties:false,
      required:["criterionId","status","excerptIds",...(isEsg ? ["potentialInconsistency"] : [])],
      properties:{criterionId:{type:"string",enum:pending.map(r=>r.id)},status:{type:"string",enum:statuses},
        excerptIds:{type:"array",items:{type:"string",enum:excerpts.map(e=>e.id)}},
        ...(isEsg ? {potentialInconsistency:{type:"boolean"}} : {})}};
    if (attempt) console.error(`Correcting only ${pending.length} unfinished report criteria; validated assessments are saved.`);
    const response = await requestGemini(ai, {...request,
      contents:JSON.stringify({...original,rubric:pending,evidence:input.evidence.map(({text,...metadata})=>metadata),excerpts}),
      config:{...request.config,systemInstruction:instruction,responseJsonSchema:{type:"object",additionalProperties:false,required:["assessments"],
        properties:{assessments:{type:"array",items:itemSchema}}}},
    },options);
    let result;
    try { result = JSON.parse(response.text); } catch { throw Error("Invalid report assessment JSON; saved criteria remain available."); }
    if (!Array.isArray(result?.assessments)) throw Error("Invalid report assessments array.");
    const counts = new Map();
    for (const item of result.assessments) counts.set(item?.criterionId,(counts.get(item?.criterionId)??0)+1);
    for (const item of result.assessments) {
      if (!pending.some(r=>r.id===item?.criterionId) || counts.get(item.criterionId)!==1) continue;
      try { materialize(item); } catch { continue; }
      options.assessmentCheckpoint?.save(key,item.criterionId,item);
      accepted.set(item.criterionId,item);
    }
  }
  if (accepted.size !== rubric.length) throw Error(`Unfinished report criteria: ${rubric.filter(r=>!accepted.has(r.id)).map(r=>r.id).join(", ")}. Valid assessments are saved; repeat the command to request only unfinished criteria.`);
  return {assessments:rubric.map(r=>materialize(accepted.get(r.id)))};
}
