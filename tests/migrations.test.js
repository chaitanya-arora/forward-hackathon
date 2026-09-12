import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrateReportOutputs } from "../src/database/migrations.js";

test("typed-output migration preserves legacy rows and JSON, is repeatable, and enforces immutable outputs", () => {
  const db=new Database(":memory:");
  try {
    db.pragma("foreign_keys=ON");
    db.exec(`CREATE TABLE pipeline_runs(id INTEGER PRIMARY KEY);
      CREATE TABLE reports(id INTEGER PRIMARY KEY,run_id INTEGER UNIQUE REFERENCES pipeline_runs(id),report_json TEXT,created_at TEXT);
      CREATE TABLE classifications(id INTEGER PRIMARY KEY,pillars_json TEXT);
      CREATE TABLE memos(id INTEGER PRIMARY KEY,memo_markdown TEXT);
      INSERT INTO pipeline_runs VALUES(1);
      INSERT INTO reports VALUES(7,1,'{"company":"Legacy","aasbS2":{"readinessScore":0}}','2025-01-01');
      INSERT INTO classifications VALUES(1,'{}'); INSERT INTO memos VALUES(1,'Original memo');`);
    const legacy=db.prepare("SELECT * FROM reports").all();
    migrateReportOutputs(db); migrateReportOutputs(db);
    assert.deepEqual(db.prepare("SELECT * FROM reports").all(),legacy);
    assert.equal(db.prepare("SELECT report_json FROM report_outputs WHERE id=7").get().report_json,legacy[0].report_json);
    assert.equal(db.prepare("SELECT count(*) AS n FROM classifications").get().n,1);
    assert.equal(db.prepare("SELECT memo_markdown FROM memos").get().memo_markdown,"Original memo");
    db.prepare("INSERT INTO report_outputs(run_id,report_type,report_json) VALUES(1,'aasb_s2','{}')").run();
    assert.equal(db.prepare("SELECT count(*) AS n FROM report_outputs").get().n,2);
    assert.throws(()=>db.exec("UPDATE report_outputs SET report_json='{}'"),/immutable/);
    assert.throws(()=>db.exec("DELETE FROM report_outputs"),/immutable/);
    assert.deepEqual(db.pragma("foreign_key_check"),[]);
  } finally {db.close();}
});
