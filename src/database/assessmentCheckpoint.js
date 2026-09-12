export function assessmentCheckpoint(db, companyId, reportType) {
  db.exec(`CREATE TABLE IF NOT EXISTS assessment_checkpoints (
    company_id INTEGER NOT NULL REFERENCES companies(id),
    report_type TEXT NOT NULL,
    snapshot_key TEXT NOT NULL,
    criterion_id TEXT NOT NULL,
    assessment_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(company_id,report_type,snapshot_key,criterion_id)
  )`);
  return {
    get(key, criterion) {
      const row=db.prepare("SELECT assessment_json FROM assessment_checkpoints WHERE company_id=? AND report_type=? AND snapshot_key=? AND criterion_id=?").get(companyId,reportType,key,criterion);
      return row ? JSON.parse(row.assessment_json) : undefined;
    },
    save(key,criterion,item) {
      db.prepare("INSERT OR IGNORE INTO assessment_checkpoints(company_id,report_type,snapshot_key,criterion_id,assessment_json) VALUES(?,?,?,?,?)").run(companyId,reportType,key,criterion,JSON.stringify(item));
    },
  };
}
