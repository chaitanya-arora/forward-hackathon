/**
 * db.js — shared SQLite setup for the ESG project
 *
 * Two tables:
 *   - classifications: raw output from Agent 1 (per-pillar text chunks + confidence)
 *   - memos: scored output from Agent 2 (Red/Amber/Green + final memo text)
 *
 * Both are keyed by (company_name, report_year) so they can be joined together.
 *
 * Usage (from agent1.js or agent2.js):
 *   import { db, saveClassification, saveMemo, getClassification, getMemo, listCompanies } from "./db.js";
 */

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { config } from "dotenv";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
config({ path: resolve(projectRoot, ".env"), quiet: true });
const databasePath = process.env.ESG_DB_PATH
  ? resolve(projectRoot, process.env.ESG_DB_PATH)
  : resolve(projectRoot, "storage/database/esg_reports.db");
mkdirSync(dirname(databasePath), { recursive: true });

// Upgrade older checkouts using SQLite's backup API, which includes WAL data.
// Preserve the old file as a recovery copy; never silently overwrite a new DB.
const legacyPath = resolve(projectRoot, "esg_reports.db");
if (!process.env.ESG_DB_PATH && !existsSync(databasePath) && existsSync(legacyPath)) {
  const legacy = new Database(legacyPath, { readonly: true });
  try { await legacy.backup(databasePath); } finally { legacy.close(); }
}

// Keep one project database regardless of the terminal's working directory.
// Tests may select an isolated database without touching saved company data.
export const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// Improves reliability for concurrent-ish access (two agents writing at
// different times) and is generally recommended for better-sqlite3.
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    report_year TEXT NOT NULL,
    pillars_json TEXT NOT NULL,   -- the full Agent 1 output schema, stored as JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_name, report_year)
  )
`);

// Additive schema: keep the teammate's classifications/memos tables intact.
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    report_year TEXT NOT NULL,
    filename TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('public','internal','unknown')),
    mime_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    byte_length INTEGER NOT NULL,
    content BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, report_year, sha256, filename, source_type)
  );
  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    report_year TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('extracting','analysing','completed','failed')),
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS run_documents (
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id),
    document_id INTEGER NOT NULL REFERENCES documents(id),
    evidence_json TEXT,
    PRIMARY KEY(run_id, document_id)
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS documents_company_year ON documents(company_id, report_year);
  CREATE INDEX IF NOT EXISTS runs_company_year ON pipeline_runs(company_id, report_year);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    report_year TEXT NOT NULL,
    governance_score TEXT,
    governance_justification TEXT,
    strategy_score TEXT,
    strategy_justification TEXT,
    risk_management_score TEXT,
    risk_management_justification TEXT,
    metrics_targets_score TEXT,
    metrics_targets_justification TEXT,
    overall_summary TEXT,
    memo_markdown TEXT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_name, report_year)
  )
`);

// ---------------------------------------------------------------------------
// Classifications (Agent 1)
// ---------------------------------------------------------------------------

export function saveClassification(companyName, reportYear, pillarsObj) {
  const stmt = db.prepare(`
    INSERT INTO classifications (company_name, report_year, pillars_json)
    VALUES (?, ?, ?)
    ON CONFLICT(company_name, report_year)
    DO UPDATE SET pillars_json = excluded.pillars_json, created_at = CURRENT_TIMESTAMP
  `);
  stmt.run(companyName, reportYear, JSON.stringify(pillarsObj));
}

export function getClassification(companyName, reportYear) {
  const row = db
    .prepare(
      `SELECT * FROM classifications WHERE company_name = ? AND report_year = ?`
    )
    .get(companyName, reportYear);
  if (!row) return null;
  return { ...row, pillars_json: JSON.parse(row.pillars_json) };
}

// ---------------------------------------------------------------------------
// Memos (Agent 2)
// ---------------------------------------------------------------------------

export function saveMemo(companyName, reportYear, memo) {
  const stmt = db.prepare(`
    INSERT INTO memos (
      company_name, report_year,
      governance_score, governance_justification,
      strategy_score, strategy_justification,
      risk_management_score, risk_management_justification,
      metrics_targets_score, metrics_targets_justification,
      overall_summary, memo_markdown
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_name, report_year) DO UPDATE SET
      governance_score = excluded.governance_score,
      governance_justification = excluded.governance_justification,
      strategy_score = excluded.strategy_score,
      strategy_justification = excluded.strategy_justification,
      risk_management_score = excluded.risk_management_score,
      risk_management_justification = excluded.risk_management_justification,
      metrics_targets_score = excluded.metrics_targets_score,
      metrics_targets_justification = excluded.metrics_targets_justification,
      overall_summary = excluded.overall_summary,
      memo_markdown = excluded.memo_markdown,
      generated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    companyName,
    reportYear,
    memo.governance.score,
    memo.governance.justification,
    memo.strategy.score,
    memo.strategy.justification,
    memo.risk_management.score,
    memo.risk_management.justification,
    memo.metrics_targets.score,
    memo.metrics_targets.justification,
    memo.overall_summary,
    memo.memo_markdown
  );
}

export function getMemo(companyName, reportYear) {
  return db
    .prepare(`SELECT * FROM memos WHERE company_name = ? AND report_year = ?`)
    .get(companyName, reportYear);
}

// ---------------------------------------------------------------------------
// Convenience: list everything stored so far (handy for a demo dropdown/UI)
// ---------------------------------------------------------------------------

export function listCompanies() {
  return db
    .prepare(`SELECT company_name, report_year, generated_at FROM memos ORDER BY generated_at DESC`)
    .all();
}
