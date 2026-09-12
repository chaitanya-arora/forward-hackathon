import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { db } from "../database/db.js";
import { createCompany, storeDocument, getReport, getRun, getAasbS2Report, getEsgReport, listCompanies, listDocuments, listRuns, MAX_DOCUMENT_BYTES } from "../database/repository.js";
import { processCompany } from "./processCompany.js";
import { prepareExtraction, extractionBatches } from "../agent1/agent1.js";
import { extractionCheckpoint } from "../database/extractionCheckpoint.js";
import { getCompany, getDocument } from "../database/repository.js";

const [command, ...args] = process.argv.slice(2);
const print = (value) => console.log(JSON.stringify(value, null, 2));
const id = (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error("IDs must be positive integers.");
  return number;
};
try {
  if (command === "company" && args.length === 1) print(createCompany(args[0]));
  else if (command === "companies" && !args.length) print(listCompanies());
  else if (["report-aasb", "report-esg", "export-aasb", "export-esg"].includes(command)) {
    const exporting = command.startsWith("export-");
    if ((!exporting && args.length !== 2) || (exporting && ![2,3].includes(args.length))) throw new Error("Provide companyId and reportId; exports accept an optional output.json path.");
    const aasb = command.endsWith("aasb");
    const saved = (aasb ? getAasbS2Report : getEsgReport)(id(args[0]), id(args[1]));
    if (!exporting) print(saved);
    else {
      const outputPath = resolve(args[2] ?? (aasb ? "aasbS2Report.json" : "esgReport.json"));
      if (!outputPath.toLowerCase().endsWith(".json")) throw new Error("Report exports must use a .json filename.");
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(saved.report, null, 2) + "\n");
      print({ reportId: saved.id, outputPath });
    }
  }
  else if (command === "upload" && [3,4].includes(args.length)) {
    const [company, year, path, sourceType = "unknown"] = args;
    if ((await stat(path)).size > MAX_DOCUMENT_BYTES) throw new Error("Document exceeds 25 MiB.");
    print(storeDocument({ companyId: id(company), reportYear: year, filename: basename(path), sourceType, content: await readFile(path) }));
  } else if (command === "documents" && args.length === 2) print(listDocuments(id(args[0]), args[1]));
  else if (command === "estimate" && args.length >= 2) {
    const companyId = id(args[0]);
    getCompany(companyId);
    const documents = listDocuments(companyId, args[1]);
    const selected = args.length > 2 ? [...new Set(args.slice(2).map(id))] : documents.map(d => d.id);
    if (!selected.length) throw new Error("No documents selected.");
    const estimates = [];
    for (const documentId of selected) {
      if (!documents.some(d => d.id === documentId)) throw new Error("Document not found for this company and year.");
      const document = getDocument(companyId, documentId, true);
      if (document.mime_type !== "application/pdf") throw new Error("Only PDFs can currently be extracted.");
      const { chunks, keys, model } = await prepareExtraction(document.content);
      const checkpoint = extractionCheckpoint(db, documentId);
      const cachedChunks = keys.filter(key => checkpoint.get(key) !== undefined).length;
      const pending = keys.flatMap((key, i) => checkpoint.get(key) === undefined ? [i] : []);
      estimates.push({ documentId, filename: document.filename, model, chunks: chunks.length, cachedChunks,
        remainingExtractionRequests: extractionBatches(chunks, pending).length });
    }
    const remainingExtractionRequests = estimates.reduce((sum, d) => sum + d.remainingExtractionRequests, 0);
    print({ documents: estimates, remainingExtractionRequests, reportRequests: 2,
      estimatedRemainingRequests: remainingExtractionRequests + 2,
      note: "Offline estimate: no API calls. Excludes retries and other project usage; report calls may be skipped for empty evidence. This does not check available provider quota." });
  }
  else if (command === "process" && args.length >= 2) {
    const contextIndex = args.indexOf("--context");
    let reportingContext = {};
    if (contextIndex !== -1) {
      if (contextIndex < 2 || !args[contextIndex + 1]) throw new Error("--context needs a JSON file after company and year.");
      reportingContext = JSON.parse(await readFile(args[contextIndex + 1], "utf8"));
      args.splice(contextIndex, 2);
    }
    print(await processCompany({ companyId: id(args[0]), reportYear: args[1], reportingContext, documentIds: args.length > 2 ? args.slice(2).map(id) : undefined }, {
      onRunCreated: (runId) => console.error(`Processing run ${runId}...`),
      agent1: { onProgress: ({ completed, total, reused }) => console.error(`Extraction ${completed}/${total}: ${reused ? "reused saved classification" : "classified and saved"}`) },
    }));
  } else if (command === "runs" && args.length === 1) print(listRuns(id(args[0])));
  else if (command === "run" && args.length === 2) print(getRun(id(args[0]), id(args[1])));
  else if (command === "report" && args.length === 2) print(getReport(id(args[0]), id(args[1])));
  else throw new Error('Usage: pipeline company "Name" | companies | upload <companyId> <year> <file> [public|internal|unknown] | documents <companyId> <year> | process <companyId> <year> [documentIds...] [--context context.json] | runs <companyId> | run <companyId> <runId> | report-aasb/report-esg <companyId> <reportId> | export-aasb/export-esg <companyId> <reportId> [output.json] | report <companyId> <legacyReportId>');
} catch (error) {
  console.error(`Pipeline${error.runId ? ` run ${error.runId}` : ""}: ${error.message}${error.geminiHint ? " " + error.geminiHint : ""}`);
  if (error.runId) console.error("Successful extraction chunks are saved. After resolving the error, repeat the same process command to reuse them in a new run; do not upload the document again.");
  process.exitCode = 1;
} finally { db.close(); }
