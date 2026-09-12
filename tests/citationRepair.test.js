import test from "node:test";
import assert from "node:assert/strict";
import { buildWithCitationRepair, validateCitations } from "../src/agent2/validateCitations.js";

test("citation repair runs once and still rejects fabricated quotes and wrong IDs", async () => {
  const input = { evidence: [{id:"e1",text:"The board reviews climate risks quarterly."}] };
  const good = [{evidenceId:"e1",quote:input.evidence[0].text}];
  const bad = [{evidenceId:"e1",quote:"The board reviews climate risks weekly."}];
  const build = value => validateCitations(value,input,"governance.responsibleBody");
  let calls=0;
  assert.deepEqual(await buildWithCitationRepair(good,build,async()=>{calls++;return good;}),good);
  assert.equal(calls,0);
  assert.deepEqual(await buildWithCitationRepair(bad,build,async()=>{calls++;return good;}),good);
  assert.equal(calls,1);
  await assert.rejects(buildWithCitationRepair(bad,build,async()=>{calls++;return bad;}),/Unverifiable/);
  assert.equal(calls,2);
  await assert.rejects(buildWithCitationRepair([{...good[0],evidenceId:"wrong"}],build,async()=>[{...good[0],evidenceId:"wrong"}]),/Unverifiable/);
  await assert.rejects(buildWithCitationRepair(null,build,async()=>{throw Error("must not repair malformed arrays");}),/Invalid citations/);
});
