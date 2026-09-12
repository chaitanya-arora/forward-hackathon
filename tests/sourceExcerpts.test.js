import test from "node:test";
import assert from "node:assert/strict";
import { sourceExcerpts } from "../src/agent2/sourceExcerpts.js";
import { responseJsonSchema } from "../src/aasb/rubric.js";
import { createGeminiRequester } from "../src/llm/gemini.js";

test("excerpts preserve every source character and reject invented IDs and quotations", () => {
  const text = "[Page 3] The board does not approve this plan.  ".repeat(100);
  const source = sourceExcerpts({evidence:[{id:"e1",text,documentId:2,pages:[3]}]},responseJsonSchema);
  assert.equal(source.evidence[0].excerpts.map(e=>e.text).join(""),text);
  const result = source.resolve({assessments:[{citations:[{excerptId:"e1_2"}]}]});
  assert.equal(result.assessments[0].citations[0].quote,source.evidence[0].excerpts[1].text);
  assert.equal(result.assessments[0].citations[0].evidenceId,"e1");
  assert.throws(()=>source.resolve({assessments:[{citations:[{excerptId:"invented"}]}]}),/Unknown/);
  assert.throws(()=>source.resolve({assessments:[{citations:[{evidenceId:"e1",quote:text}]}]}),/model-written/);
});

test("shared requester stops before physical call 21", async () => {
  const request = createGeminiRequester({minIntervalMs:0,maxRetries:0});
  let calls=0;
  for(let i=0;i<20;i++) await request(async()=>++calls);
  await assert.rejects(request(async()=>++calls),/20 API attempts/);
  assert.equal(calls,20);
});

