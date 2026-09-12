import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ReportSchema, type Report } from "@climate/contract";

/**
 * Single stored document, upserted on every completed run (spec §7).
 * No history, no versioning, no auth.
 */
export interface ReportStore {
  save(report: Report): Promise<void>;
  latest(): Promise<Report | null>;
}

class FileStore implements ReportStore {
  private readonly file: string;

  constructor(dir = path.resolve(process.cwd(), ".data")) {
    this.file = path.join(dir, "latest.json");
  }

  async save(report: Report): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(report, null, 2), "utf8");
  }

  async latest(): Promise<Report | null> {
    try {
      const raw = await readFile(this.file, "utf8");
      return ReportSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

class MongoStore implements ReportStore {
  private collection: Promise<import("mongodb").Collection>;

  constructor(uri: string) {
    this.collection = (async () => {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(uri);
      await client.connect();
      return client.db(process.env.MONGODB_DB ?? "climate").collection("reports");
    })();
  }

  async save(report: Report): Promise<void> {
    const col = await this.collection;
    await col.updateOne({ _id: "latest" as never }, { $set: report }, { upsert: true });
  }

  async latest(): Promise<Report | null> {
    const col = await this.collection;
    const doc = await col.findOne({ _id: "latest" as never });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    const parsed = ReportSchema.safeParse(rest);
    return parsed.success ? parsed.data : null;
  }
}

export function createStore(): ReportStore {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    console.log("[store] using MongoDB");
    return new MongoStore(uri);
  }
  console.log("[store] using local file store (.data/latest.json) — set MONGODB_URI to use Atlas");
  return new FileStore();
}
