import { createHash } from "node:crypto";
import { db } from "./db.js";

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
function requiredText(value, label, limit = 255) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new TypeError(`${label} is required (maximum ${limit} characters).`);
  return value.trim();
}
export function validateYear(value) {
  const year = String(value ?? "");
  if (!/^\d{4}$/.test(year)) throw new TypeError("reportYear must be a four-digit year.");
  return year;
}
export function getCompany(id) {
  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
  if (!company) throw new Error("Company not found.");
  return company;
}
export function createCompany(name) {
  name = requiredText(name, "Company name");
  db.prepare("INSERT INTO companies(name) VALUES (?) ON CONFLICT(name) DO NOTHING").run(name);
  return db.prepare("SELECT * FROM companies WHERE name = ? COLLATE NOCASE").get(name);
}
export function listCompanies() {
  return db.prepare("SELECT * FROM companies ORDER BY name").all();
}

// Store the original bytes, not a client-supplied filesystem path.
export function storeDocument({ companyId, reportYear, filename, sourceType = "unknown", content }) {
  getCompany(companyId);
  reportYear = validateYear(reportYear);
  filename = requiredText(filename, "Filename").split(/[\\/]/).pop();
  if (!filename || filename === "." || filename === "..") throw new TypeError("Invalid filename.");
  if (!["public", "internal", "unknown"].includes(sourceType)) throw new TypeError("Invalid sourceType.");
  if (!Buffer.isBuffer(content) || !content.length || content.length > MAX_DOCUMENT_BYTES) throw new TypeError("Document must contain 1 byte to 25 MiB of data.");
  const hash = createHash("sha256").update(content).digest("hex");
  const mime = content.subarray(0, 1024).includes(Buffer.from("%PDF-")) ? "application/pdf" : "application/octet-stream";
  const result = db.prepare(`INSERT INTO documents(company_id,report_year,filename,source_type,mime_type,sha256,byte_length,content)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(company_id,report_year,sha256,filename,source_type) DO NOTHING`)
    .run(companyId, reportYear, filename, sourceType, mime, hash, content.length, content);
  const row = db.prepare(`SELECT id FROM documents WHERE company_id=? AND report_year=? AND sha256=? AND filename=? AND source_type=?`)
    .get(companyId, reportYear, hash, filename, sourceType);
  return { ...getDocument(companyId, row.id), duplicate: result.changes === 0 };
}
const documentColumns = "id,company_id,report_year,filename,source_type,mime_type,sha256,byte_length,created_at";
export function getDocument(companyId, documentId, includeContent = false) {
  const row = db.prepare(`SELECT ${documentColumns}${includeContent ? ",content" : ""} FROM documents WHERE company_id=? AND id=?`).get(companyId, documentId);
  if (!row) throw new Error("Document not found for this company.");
  return row;
}
export function listDocuments(companyId, reportYear) {
  getCompany(companyId);
  return db.prepare(`SELECT ${documentColumns} FROM documents WHERE company_id=? AND report_year=? ORDER BY id`).all(companyId, validateYear(reportYear));
}

export const createRun = db.transaction((companyId, reportYear, documentIds, context = {}) => {
  getCompany(companyId);
  reportYear = validateYear(reportYear);
  if (!Array.isArray(documentIds) || !documentIds.length || documentIds.length > 20 || new Set(documentIds).size !== documentIds.length) throw new TypeError("Select 1–20 distinct document IDs.");
  for (const id of documentIds) {
    const doc = getDocument(companyId, id);
    if (doc.report_year !== reportYear) throw new Error("Document reporting year does not match this run.");
  }
  const runId = Number(db.prepare("INSERT INTO pipeline_runs(company_id,report_year,status) VALUES (?,?,'extracting')").run(companyId, reportYear).lastInsertRowid);
  db.prepare("INSERT INTO run_details(run_id,stage,context_json) VALUES (?,'created',?)").run(runId, JSON.stringify(context));
  for (const id of documentIds) db.prepare("INSERT INTO run_documents(run_id,document_id) VALUES (?,?)").run(runId, id);
  return runId;
});
export function getRun(companyId, runId) {
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE company_id=? AND id=?").get(companyId, runId);
  if (!row) throw new Error("Run not found for this company.");
  const documents = db.prepare("SELECT document_id,evidence_json FROM run_documents WHERE run_id=? ORDER BY document_id").all(runId)
    .map((doc) => ({ documentId: doc.document_id, evidence: doc.evidence_json ? JSON.parse(doc.evidence_json) : null }));
  const report = db.prepare("SELECT id FROM reports WHERE run_id=?").get(runId);
  const outputs = db.prepare("SELECT id,report_type FROM report_outputs WHERE run_id=?").all(runId);
  const details = db.prepare("SELECT * FROM run_details WHERE run_id=?").get(runId);
  return { ...row, documents, reportId: report?.id ?? null,
    reportIds: { aasbS2: outputs.find(r => r.report_type === "aasb_s2")?.id ?? null, esg: outputs.find(r => r.report_type === "esg")?.id ?? null },
    stage: details?.stage ?? row.status, reportingContext: details ? JSON.parse(details.context_json) : null,
    evidenceSnapshot: details?.normalized_evidence_json ? JSON.parse(details.normalized_evidence_json) : null,
  };
}
export function listRuns(companyId) {
  getCompany(companyId);
  return db.prepare("SELECT * FROM pipeline_runs WHERE company_id=? ORDER BY id DESC").all(companyId);
}
export function getReport(companyId, reportId) {
  const row = db.prepare(`SELECT reports.* FROM reports JOIN pipeline_runs ON pipeline_runs.id=reports.run_id
    WHERE pipeline_runs.company_id=? AND reports.id=?`).get(companyId, reportId);
  if (!row) throw new Error("Report not found for this company.");
  return { id: row.id, runId: row.run_id, createdAt: row.created_at, report: JSON.parse(row.report_json) };
}

export function getTypedReport(companyId, reportId, reportType) {
  if (!["aasb_s2", "esg"].includes(reportType)) throw new TypeError("Unknown report type.");
  const row = db.prepare(`SELECT o.* FROM report_outputs o JOIN pipeline_runs r ON r.id=o.run_id
    WHERE r.company_id=? AND o.id=? AND o.report_type=?`).get(companyId, reportId, reportType);
  if (!row) throw new Error("Typed report not found for this company.");
  return { id: row.id, runId: row.run_id, reportType: row.report_type, legacy: row.legacy_report_id !== null,
    createdAt: row.created_at, report: JSON.parse(row.report_json) };
}
export const getAasbS2Report = (companyId, reportId) => getTypedReport(companyId, reportId, "aasb_s2");
export const getEsgReport = (companyId, reportId) => getTypedReport(companyId, reportId, "esg");
export function saveTypedReport(runId, reportType, report) {
  if (!["aasb_s2", "esg"].includes(reportType)) throw new TypeError("Unknown report type.");
  return Number(db.prepare("INSERT INTO report_outputs(run_id,report_type,report_json) VALUES (?,?,?)")
    .run(runId, reportType, JSON.stringify(report)).lastInsertRowid);
}
export const setRunStage = db.transaction((runId, stage, evidenceSnapshot) => {
  if (!["extracting", "aasb_analysing", "esg_analysing", "completed"].includes(stage)) throw new Error("Invalid pipeline stage.");
  db.prepare("UPDATE run_details SET stage=? WHERE run_id=?").run(stage, runId);
  if (evidenceSnapshot) db.prepare("UPDATE run_details SET normalized_evidence_json=? WHERE run_id=? AND normalized_evidence_json IS NULL").run(JSON.stringify(evidenceSnapshot), runId);
  db.prepare("UPDATE pipeline_runs SET status=?,finished_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?")
    .run(stage === "extracting" ? "extracting" : stage === "completed" ? "completed" : "analysing", stage, runId);
});
export const failRun = db.transaction((runId) => {
  db.prepare("UPDATE pipeline_runs SET status='failed',error=?,finished_at=CURRENT_TIMESTAMP WHERE id=?")
    .run("Processing failed. Uploaded documents, extracted evidence and completed reports are retained. Start a new run after resolving the cause.", runId);
  // Keep the last detailed stage to show where failure occurred.
});
