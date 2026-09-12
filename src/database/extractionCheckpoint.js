// Document-scoped, durable classification checkpoints. Original uploads and run
// snapshots remain unchanged; a new run assembles its own evidence from these.
export function migrateExtractionCheckpoints(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS extraction_checkpoints (
    document_id INTEGER NOT NULL REFERENCES documents(id),
    cache_key TEXT NOT NULL,
    classification_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(document_id, cache_key)
  )`);
}

export function extractionCheckpoint(db, documentId) {
  const read = db.prepare("SELECT classification_json FROM extraction_checkpoints WHERE document_id=? AND cache_key=?");
  const write = db.prepare("INSERT OR IGNORE INTO extraction_checkpoints(document_id,cache_key,classification_json) VALUES(?,?,?)");
  return {
    get(key) {
      const row = read.get(documentId, key);
      return row ? JSON.parse(row.classification_json) : undefined;
    },
    save(key, result) { write.run(documentId, key, JSON.stringify(result)); },
  };
}
