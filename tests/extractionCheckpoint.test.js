import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractEvidence, prepareExtraction, extractionBatches } from "../src/agent1/agent1.js";
import { extractionCheckpoint, migrateExtractionCheckpoints } from "../src/database/extractionCheckpoint.js";

function pdf() {
  const text = "The board reviews climate risks quarterly. ".repeat(110);
  const stream = `BT /F1 12 Tf 40 750 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>",
    ...[1,2,3].map(() => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100000 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 7 0 R >>"),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let value = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => { const offset = Buffer.byteLength(value); value += `${i+1} 0 obj\n${object}\nendobj\n`; return offset; });
  const start = Buffer.byteLength(value);
  value += `xref\n0 8\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10,"0") + " 00000 n \n").join("")}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(value);
}
const classification = { pillar: "governance", confidence: 0.95, justification: "Board oversight" };

test("partial document checkpoints survive restart and resume only pending chunks", async () => {
  const dir = mkdtempSync(join(tmpdir(), "extraction-checkpoint-"));
  let db = new Database(join(dir, "test.db"));
  try {
    db.exec("CREATE TABLE documents(id INTEGER PRIMARY KEY); INSERT INTO documents VALUES(1),(2)");
    migrateExtractionCheckpoints(db);
    migrateExtractionCheckpoints(db);
    const bytes = pdf();
    const prepared = await prepareExtraction(bytes);
    assert.equal(prepared.chunks.length, 3);
    let calls = 0;
    const client = { models: { async generateContent() { if (++calls === 2) throw new Error("daily quota"); return {text:JSON.stringify(classification)}; } } };
    await assert.rejects(extractEvidence(bytes, "Test", "2026", {client, batchSize:1, checkpoint:extractionCheckpoint(db,1)}), /daily quota/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM extraction_checkpoints").get().n, 1);
    db.close(); db = new Database(join(dir, "test.db"));
    let resumedCalls = 0;
    const resumed = { models: { async generateContent(request) {
      resumedCalls++;
      const chunks = JSON.parse(request.contents).chunks;
      assert.deepEqual(chunks.map(c=>c.chunkId), [1,2]);
      return {text:JSON.stringify({classifications:chunks.toReversed().map(c=>({...classification,chunkId:c.chunkId}))})};
    } } };
    const output = await extractEvidence(bytes, "Test", "2026", {client:resumed, checkpoint:extractionCheckpoint(db,1)});
    assert.equal(resumedCalls, 1);
    assert.deepEqual(output.pillars.governance.source_pages, [1,2,3]);
    assert.equal(output.pillars.governance.raw_text_chunks.length, 3);
    assert.equal(extractionCheckpoint(db,2).get(prepared.keys[0]), undefined);
    const changed = await prepareExtraction(bytes, {model:"different-model"});
    assert.equal(extractionCheckpoint(db,1).get(changed.keys[0]), undefined);
    assert.deepEqual(await extractEvidence(bytes,"Test","2026",{client:{models:{generateContent(){throw Error("must not call");}}},checkpoint:extractionCheckpoint(db,1)}), output);
    await assert.rejects(extractEvidence(bytes,"Test","2026", {client:{models:{async generateContent(){return {text:JSON.stringify({classifications:[{...classification,chunkId:0},{...classification,chunkId:0},{...classification,chunkId:2}]})};}}},checkpoint:extractionCheckpoint(db,2)}), /chunk IDs/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM extraction_checkpoints WHERE document_id=2").get().n, 0);
    assert.equal(extractionBatches(prepared.chunks, [0,1,2], {batchSize:1}).length, 3);
    assert.throws(()=>extractionBatches([],[],{batchSize:0}), /integer/);
  } finally { if(db.open) db.close(); rmSync(dir,{recursive:true,force:true}); }
});

