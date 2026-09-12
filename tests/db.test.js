import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("SQLite stores and updates classifications without touching company data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "esg-db-test-"));
  const previous = process.env.ESG_DB_PATH;
  process.env.ESG_DB_PATH = join(directory, "test.db");
  let storage;
  try {
    storage = await import("../src/database/db.js");
    assert.equal(storage.getClassification("Fixture", "2025"), null);
    storage.saveClassification("Fixture", "2025", { governance: { raw_text_chunks: [] } });
    const updated = { governance: { raw_text_chunks: [{ text: "Board oversight" }] } };
    storage.saveClassification("Fixture", "2025", updated);
    assert.deepEqual(storage.getClassification("Fixture", "2025").pillars_json, updated);
    assert.equal(storage.db.prepare("SELECT count(*) AS n FROM classifications").get().n, 1);
    assert.deepEqual(storage.listCompanies(), []);
  } finally {
    storage?.db.close();
    if (previous === undefined) delete process.env.ESG_DB_PATH;
    else process.env.ESG_DB_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
