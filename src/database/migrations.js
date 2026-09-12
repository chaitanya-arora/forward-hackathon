// Additive, transactional upgrade. Historical report JSON is never rewritten.
export function migrateReportOutputs(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version=1").get()) return;
  db.transaction(() => {
    db.exec(`
      CREATE TABLE report_outputs (
        id INTEGER PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES pipeline_runs(id),
        report_type TEXT NOT NULL CHECK(report_type IN ('aasb_s2','esg')),
        report_json TEXT NOT NULL,
        legacy_report_id INTEGER UNIQUE REFERENCES reports(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(run_id,report_type)
      );
      CREATE TABLE run_details (
        run_id INTEGER PRIMARY KEY REFERENCES pipeline_runs(id),
        stage TEXT NOT NULL,
        context_json TEXT NOT NULL,
        normalized_evidence_json TEXT
      );
      INSERT INTO report_outputs(id,run_id,report_type,report_json,legacy_report_id,created_at)
        SELECT id,run_id,'esg',report_json,id,created_at FROM reports;
      CREATE TRIGGER report_outputs_no_update BEFORE UPDATE ON report_outputs
        BEGIN SELECT RAISE(ABORT,'Reports are immutable; create a new run'); END;
      CREATE TRIGGER report_outputs_no_delete BEFORE DELETE ON report_outputs
        BEGIN SELECT RAISE(ABORT,'Reports are immutable; create a new run'); END;
      INSERT INTO schema_migrations(version) VALUES(1);
    `);
  })();
}
