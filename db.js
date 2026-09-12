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

// Keep one project database regardless of the terminal's working directory.
// Tests may select an isolated database without touching saved company data.
export const db = new Database(process.env.ESG_DB_PATH || fileURLToPath(new URL("./esg_reports.db", import.meta.url)));

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
