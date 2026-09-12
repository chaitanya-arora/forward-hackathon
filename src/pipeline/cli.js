import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { db } from "../database/db.js";
import { createCompany, storeDocument, getReport, getRun, listCompanies, listDocuments, listRuns, MAX_DOCUMENT_BYTES } from "../database/repository.js";
import { processCompany } from "./processCompany.js";

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
  else if (command === "upload" && [3,4].includes(args.length)) {
    const [company, year, path, sourceType = "unknown"] = args;
    if ((await stat(path)).size > MAX_DOCUMENT_BYTES) throw new Error("Document exceeds 25 MiB.");
    print(storeDocument({ companyId: id(company), reportYear: year, filename: basename(path), sourceType, content: await readFile(path) }));
  } else if (command === "documents" && args.length === 2) print(listDocuments(id(args[0]), args[1]));
  else if (command === "process" && args.length >= 2) {
    print(await processCompany({ companyId: id(args[0]), reportYear: args[1], documentIds: args.length > 2 ? args.slice(2).map(id) : undefined }, {
      onRunCreated: (runId) => console.error(`Processing run ${runId}...`),
    }));
  } else if (command === "runs" && args.length === 1) print(listRuns(id(args[0])));
  else if (command === "run" && args.length === 2) print(getRun(id(args[0]), id(args[1])));
  else if (command === "report" && args.length === 2) print(getReport(id(args[0]), id(args[1])));
  else throw new Error('Usage: pipeline company "Name" | companies | upload <companyId> <year> <file> [public|internal|unknown] | documents <companyId> <year> | process <companyId> <year> [documentIds...] | runs <companyId> | run <companyId> <runId> | report <companyId> <reportId>');
} catch (error) {
  console.error(`Pipeline${error.runId ? ` run ${error.runId}` : ""}: ${error.message}`);
  process.exitCode = 1;
} finally { db.close(); }
