# Forward — ESG reporting pipeline

A hackathon backend that stores company documents, extracts source evidence, and
produces an ESG evidence-readiness report with a separate AASB S2 climate section.

**Start here:** use the full pipeline below when you want uploads and reports saved
in SQLite. The standalone Agent 2 command is still available for a quick JSON demo.

## What works now

- Create company records and store original uploaded file bytes in SQLite.
- Associate documents with a company, reporting year and public/internal visibility.
- Extract text from PDFs and classify it through Agent 1 using Gemini.
- Combine evidence from selected documents while retaining document IDs and citations.
- Generate Environmental, Social and Governance assessments through Agent 2.
- Save full report JSON, extraction snapshots, run status and failure history.
- Retrieve documents, runs and reports through JavaScript functions or the CLI.

There is **no HTTP upload endpoint, Express server, React UI, authentication, or
background worker yet**. The service functions are ready for those integrations.
Other file types can be stored, but only text-bearing PDFs can currently be processed.

## Architecture

```text
Future React upload screen
        │  Future authenticated HTTP API
        ▼
Company + document metadata + original bytes
        │  src/database/repository.js
        ▼
SQLite documents (BLOB storage)
        │  src/pipeline/processCompany.js
        ▼
Agent 1: PDF bytes → page text → classified evidence JSON
        │  extraction snapshot saved per document and run
        ▼
Agent 2: combined evidence → Gemini assessment → citation checks → JS scoring
        │
        ▼
SQLite reports (complete JSON) + completed pipeline run
        │
        ▼
Future React report screen / document citations / report history
```

The CLI exercises the same database and service functions that a future API will
call. There is no separate CLI-only implementation of the business pipeline.

## Folder structure

```text
forward-hackathon/
├── README.md                        Project setup and integration contract
├── .env                             Local secrets/settings; ignored by Git
├── .env.example                     Shareable template with no real key
├── package.json                     Shared dependencies and npm commands
├── package-lock.json                Reproducible dependency versions
├── run-pipeline.ps1                  Windows launcher for the stored-document flow
├── run-agent2.ps1                    Standalone Agent 2 demo and test launcher
├── src/
│   ├── agent1/
│   │   ├── agent1.js                Importable PDF extractor + standalone CLI
│   │   ├── sanitycheck.py           Optional Python PDF helper
│   │   ├── README.md
│   │   ├── data/raw/                Original teammate sample PDFs
│   │   └── output/                  Standalone Agent 1 JSON examples/exports
│   ├── agent2/
│   │   ├── generateESGReport.js      Report generator + standalone CLI
│   │   ├── normalizeEvidence.js     Input adaptation and provenance
│   │   ├── rubric.js                Assessment criteria and model output schema
│   │   ├── README.md
│   │   ├── examples/                Fictional evidence input
│   │   ├── tests/                   Agent 2 unit tests
│   │   └── output/                  Standalone report exports; ignored
│   ├── database/
│   │   ├── db.js                    SQLite connection, schema, legacy functions
│   │   └── repository.js            Company/document/run/report access
│   └── pipeline/
│       ├── processCompany.js        Stored documents → persisted report
│       └── cli.js                   Command-line interface
├── tests/                           SQLite and full pipeline integration tests
├── storage/
│   ├── database/esg_reports.db      Active local SQLite database; ignored
│   └── backups/                     Local recovery copies; ignored DB files
└── node_modules/                    Installed dependencies; ignored
```

Runtime uploads belong in SQLite, not `src/agent1/data/raw/`. That folder contains
existing demo inputs. Do not add company uploads, API keys or database files to Git.
There are no empty frontend folders yet; add the web application when its framework
is chosen. Keep it separate from `src/database` and the Node-only agent code.

## Setup

Use Node.js 24 (the version tested here) and npm. Install the exact locked dependencies:

```powershell
npm ci
```

Native SQLite and PDF dependencies vary by OS. After a fresh clone, or a branch
switch that removed previously tracked `node_modules`, reinstall dependencies.
Do not copy macOS native binaries to Windows. If a recent npm version reports
blocked install scripts and a native module fails to load, review npm's listed
packages and approve the necessary dependency installation scripts.

Create `.env` in the project root if it does not exist. Preserve your existing key:

```dotenv
GEMINI_API_KEY=your_actual_key
AGENT1_MODEL=gemini-3.6-flash
AGENT2_MODEL=gemini-3.6-flash
# Optional; relative paths resolve from the project root:
# ESG_DB_PATH=storage/database/esg_reports.db
```

Both agents load the root `.env` regardless of the terminal directory. API keys
stay on the server. Non-empty evidence is sent to Gemini for processing.

On this Windows machine, the PowerShell launchers find Node on PATH or fall back
to the installed Codex runtime. If Node is unavailable, install Node and reopen
the terminal. The launchers do not install dependencies automatically.

## Run a complete company document workflow

Run these commands from the project root. Each creation command returns JSON with
an `id`. Use the returned IDs rather than assuming your company is always ID 1.

### 1. Create or find a company

```powershell
.\run-pipeline.ps1 company "Example Company"
.\run-pipeline.ps1 companies
```

Company names are trimmed and matched case-insensitively for this MVP. This is not
a legal-entity identifier or a user account.

### 2. Store a document

Replace `1` with the company ID returned above:

```powershell
.\run-pipeline.ps1 upload 1 2025 src/agent1/data/raw/quality_holdings.pdf public
.\run-pipeline.ps1 documents 1 2025
```

The upload command reads the local file and stores its actual bytes as a BLOB,
plus its filename, SHA-256, size, detected MIME type, source type and year.
`sourceType` can be `public`, `internal` or `unknown` (the default).

The same company/year/content/filename/source-type combination is deduplicated:
re-upload returns the existing document ID with `duplicate: true`. Changed content
or metadata creates a distinct document. Original documents are not overwritten.

### 3. Process the selected documents

Process all documents for that company and year:

```powershell
.\run-pipeline.ps1 process 1 2025
```

Or process specific document IDs, for example 2 and 3:

```powershell
.\run-pipeline.ps1 process 1 2025 2 3
```

This is a blocking command. Agent 1 processes PDF chunks sequentially and spaces
requests, so large reports can take time. Run status is saved before extraction.
On success the command prints:

```json
{
  "companyId": 1,
  "runId": 1,
  "id": 1,
  "createdAt": "...",
  "report": {
    "company": "Example Company",
    "overallESGScore": 0,
    "environmental": {},
    "social": {},
    "governance": {},
    "aasbS2": {},
    "priorityActions": []
  }
}
```

This is an abbreviated shape, not a predicted assessment. `id` is the report ID;
`runId` identifies the processing attempt. The full report includes criteria,
strengths, gaps, recommendations, evidence, methodology and warnings.

### 4. Retrieve status, extraction evidence and the saved report

```powershell
.\run-pipeline.ps1 runs 1
.\run-pipeline.ps1 run 1 1
.\run-pipeline.ps1 report 1 1
```

The two-argument forms take `companyId` followed by `runId` or `reportId`.
The `run` command includes per-document extraction snapshots and the final report ID.
To export the saved report wrapper to a JSON file:

```powershell
.\run-pipeline.ps1 report 1 1 > report-export.json
```

The database is the source of truth for this workflow. Running the full pipeline
does not also generate duplicate JSON files in the source folders.

All commands also work as `npm run pipeline -- <command> <arguments>` or
`node src/pipeline/cli.js <command> <arguments>` when Node/npm are on PATH.

## Standalone agent commands

For Agent 2's fictional JSON demo:

```powershell
.\run-agent2.ps1
```

This writes `src/agent2/output/esgReport.json` and does not persist to SQLite.
For the empty Agent 1 example, which does not call Gemini:

```powershell
.\run-agent2.ps1 -InputFile src/agent1/output/quality_holdings_resources_2025_classified.json
```

An empty evidence input intentionally produces zero readiness scores and missing
statuses. It does not establish that company practices are absent.

For standalone PDF extraction:

```powershell
node src/agent1/agent1.js src/agent1/data/raw/quality_holdings.pdf "Quality Holdings Resources" 2025
```

That CLI retains the teammate's legacy `classifications` upsert and JSON export
under `src/agent1/output/`. Use the full pipeline to get uploaded document records,
run history and complete ESG report persistence.

## SQLite schema and persistence

| Table | Purpose |
| --- | --- |
| `companies` | Company identity used by the new workflow |
| `documents` | Company/year, source metadata, original bytes, size and SHA-256 |
| `pipeline_runs` | One extraction/report attempt, status, timestamps and generic failure message |
| `run_documents` | Exact selected documents and each one's Agent 1 evidence JSON for that run |
| `reports` | One complete Agent 2 report JSON per successful run |
| `classifications` | Preserved legacy Agent 1 company/year classification records |
| `memos` | Preserved legacy climate-memo records/functions; not the full ESG report format |

Foreign keys are enabled. Run creation and successful report completion use short
transactions. Network calls run outside transactions. WAL mode and a five-second
busy timeout support local concurrent access; this is not a distributed job system.

`processCompany()` follows `extracting → analysing → completed`, or `failed` on a
handled error. Uploaded bytes and completed extraction snapshots survive failure.
Retry by starting a new run with the same document IDs; successful earlier reports
remain immutable. Failure details are shown by the calling CLI while only a generic
message is saved. A process crash may leave an `extracting` or `analysing` run;
automatic recovery/resume is not implemented. A new run is the recovery path.

A new checkout creates its schema automatically. If an older root `esg_reports.db`
exists and the new default database does not, startup copies it using SQLite's
backup API before adding the new tables. The old file is preserved for recovery.
Existing new databases are never overwritten by automatic migration.

On this checkout, one legacy classification was recovered from the previously
committed database, because the old local file was missing after branch changes.
It is preserved in the active database, with a recovery copy at
`storage/backups/legacy-esg_reports.db`. Legacy records are not fabricated into
uploaded-document records; their original upload bytes/provenance were never saved.

Back up SQLite using its backup API (`await db.backup(destinationPath)`) rather than
copying an open database without its WAL. Backups and original uploads are local
sensitive data. For deployment, configure `ESG_DB_PATH` on a persistent local disk,
not an ephemeral server filesystem or a live synced/shared drive. This checkout is
under OneDrive; avoid simultaneous database use/sync during the hackathon demo.

## How the agents assess evidence

Agent 1 accepts PDF bytes or a path through:

```js
import { extractEvidence } from "./src/agent1/agent1.js";
const evidence = await extractEvidence(pdfBuffer, companyName, reportYear);
```

It extracts page text, chunks it, and asks Gemini for a dominant climate pillar:
`governance`, `strategy`, `risk_management`, `metrics_targets`, or `not_relevant`.
Its original classification prompt is preserved. It only includes relevant chunks
with confidence at least 0.5. No OCR is implemented; PDFs without extractable text
fail clearly. The import does not start a CLI, save files or open SQLite.

The pipeline saves the original extraction, then adds source filename, source type
and `documentId` to combined chunks. Agent 2 assigns evidence IDs and preserves these
links. Page markers belong to their original document; pooled pillar pages are not
precise quotation locations.

Agent 2 assesses three criteria in each ESG category and four climate criteria.
It requests structured JSON and verifies citation IDs and exact quoted substrings.
JavaScript calculates `strong=1`, `partial=0.5`, `missing=0` and averages them onto
0–100. The overall ESG score averages the three rounded category scores; AASB S2 is
scored separately. Summary and recommendations are assembled from templates.

These scores measure evidence readiness, not company ESG performance or compliance.
The fixed rubric does not establish industry materiality. Missing social evidence
may reflect Agent 1's climate filtering. Quotes can exist yet be misinterpreted;
human review remains necessary. AASB S2 output is a simplified readiness view, not
legal, audit or assurance advice.

Details: [Agent 1](src/agent1/README.md) · [Agent 2](src/agent2/README.md).

## Backend functions for the future web application

Example server-side integration:

```js
import { createCompany, storeDocument, getReport } from "./src/database/repository.js";
import { processCompany } from "./src/pipeline/processCompany.js";

const company = createCompany("Example Company");
const document = storeDocument({
  companyId: company.id,
  reportYear: "2025",
  filename: "sustainability.pdf",
  sourceType: "public",
  content: uploadedFileBuffer
});
const result = await processCompany({
  companyId: company.id,
  reportYear: "2025",
  documentIds: [document.id]
});
const saved = getReport(company.id, result.id);
// Return saved.report as JSON to the report screen.
```

Use `listCompanies`, `listDocuments`, `listRuns`, `getRun` and `getReport` for view
models. `getDocument(companyId, documentId, true)` returns original `content` bytes
for an authorized download endpoint; metadata-only calls omit the BLOB. New workflow
functions live in `repository.js`; the similarly named legacy functions in `db.js`
serve the old tables.

Suggested HTTP contract — **not implemented endpoints**:

| Endpoint | Service and UI purpose |
| --- | --- |
| `POST /api/companies`, `GET /api/companies` | Create/select a company |
| `POST /api/companies/:id/documents` | Parse multipart upload; call `storeDocument` |
| `GET /api/companies/:id/documents?year=2025` | Upload list, metadata and supported types |
| `GET /api/companies/:id/documents/:documentId` | Authorized original-file download |
| `POST /api/companies/:id/runs` | Schedule `processCompany` with selected IDs/year |
| `GET /api/companies/:id/runs/:runId` | Poll status and retrieve extraction evidence |
| `GET /api/companies/:id/reports/:reportId` | Retrieve full report JSON |

A backend worker should call `processCompany` and return a run ID promptly; do not
hold a browser upload connection open for a long annual-report analysis. The service
has an `onRunCreated(runId)` callback, but no durable queue/worker is provided yet.
The future API must authenticate users, authorize company access, limit request
sizes and set download headers. Company-ID checks in the repository prevent mixed
records but are not a substitute for user authentication or tenant authorization.

React should handle company selection, upload state, document selection, processing
status, report history, ESG category cards, a separate climate panel and expandable
citations. Render quotations as text. Keep API keys, SQLite and agent imports on the
backend. Do not send BLOB contents in normal list/report responses.

## Limits and next work

- Maximum document size: 25 MiB; maximum 20 distinct documents per run.
- PDFs are detected by a header; parsing is the final validation. Other formats are
  retained but fail extraction. Password-protected PDFs and OCR are not supported.
- Agent 2 rejects more than 200,000 serialized evidence characters rather than
  silently dropping text. A large multi-document run may need a smaller selection.
- No persistent queue, automatic retry/resume, cancellation, document deletion or
  retention policy is implemented. Failed runs do not delete uploaded documents.
- No HTTP upload handling, authentication, malware scanning, UI or deployment setup
  exists yet. These must be added before exposing uploads to untrusted users.
- SQLite BLOBs keep the MVP self-contained. For larger workloads, store originals
  in object storage and retain metadata, hashes and references in the database.

## Tests and troubleshooting

```powershell
.\run-agent2.ps1 -Test
# Or:
npm test
```

The suite includes Agent 2 validation/scoring tests, a legacy SQLite test, and an
integration test using a real PDF parser and database with simulated Gemini replies.
It checks original bytes, deduplication, company/year boundaries, persisted reports,
run history, unsupported files, failure retention, provenance and database reopening.
Tests use temporary databases and do not write to the company's active database.

A live one-page pipeline smoke test is also run during verification; live output
is not an accuracy benchmark and requires API access. Large real annual reports
have not been fully evaluated by this implementation.

| Problem | Action |
| --- | --- |
| `node` not recognized | Use the PowerShell launchers or install Node and reopen the terminal |
| Missing `dotenv` / `better-sqlite3` | Run `npm ci` after cloning or switching from an older tracked-dependency branch |
| Missing API key | Edit root `.env`, not `.env.example`, and save |
| Provider rejects model | Check account access and set the appropriate `AGENT1_MODEL` / `AGENT2_MODEL` |
| Unsupported or scanned document | Original is retained; upload a text PDF or add an extractor/OCR implementation |
| Failed run | Inspect CLI error and `run` status; fix input/config and start a new run |
| All scores are zero | Inspect evidence: an empty or climate-filtered input may provide no relevant support |
| Database locked | Close competing tools/processes and avoid syncing an actively written database |

The latest edits are local working-tree changes. No commit or push is performed by
the setup, pipeline or tests.
