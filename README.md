# Forward — AASB S2 preparation and readiness

Forward is an **AI-assisted AASB S2 readiness platform** that turns uploaded corporate reports into a structured evidence-readiness assessment, identifies evidence gaps and human-review requirements, and generates a management-ready PDF report.

The AASB generator now evaluates **required information elements**, rather than
giving full credit whenever relevant text is cited. It extracts structured source
facts, checks reporting metadata against evidence, separates disclosure gaps from
human completion steps, and calculates completeness-based readiness. See
[the readiness model, schema examples, compatibility notes and test coverage](docs/aasb-readiness-model.md).
The example reporting context now leaves unknown dates and elections `null`;
enter authoritative dates only when known. No calendar year is inferred from a report year.

Every successful active run stores one canonical AASB S2 preparation/readiness report in SQLite and exports it as `aasbS2Report.json`.

SQLite is the source of truth. These filenames are export names, not required source
files. Uploaded PDFs are extracted once per run, then the AASB S2 generator reuses
the persisted evidence snapshot. Historical ESG code, rows and exports remain
available only for legacy compatibility and are not part of the active product.

## What the AASB output means

AASB S2 is **AASB S2 Climate-related Disclosures**. Every generated AASB report has:

```json
{
  "reportType": "AASB_S2_DRAFT",
  "status": "draft_for_management_director_and_assurance_review"
}
```

This software assists evidence preparation, gap analysis and review. It does not
make an unconditional compliance determination, audit or assure a report, approve
it for directors, sign a directors' declaration, or make it ready to lodge with ASIC.
Statutory climate statements, notes, directors' processes, applicable external
review/audit and lodgement remain separate human/external processes.

References used for metadata and the rubric:

- [AASB S2 September 2024](https://standards.aasb.gov.au/aasb-s2-sep-2024)
- [AASB S2 December 2025 compilation](https://standards.aasb.gov.au/aasb-s2-dec-2025)
- [AASB amendment FAQs](https://aasb.gov.au/research-resources/knowledge-hub/aasb-s2-knowledge-hub/aasb-s2-frequently-asked-questions/aasb-s2-amendments-faqs/)
- [ASIC reporting applicability](https://www.asic.gov.au/regulatory-resources/sustainability-reporting/for-preparers-of-sustainability-reports/who-must-prepare-a-sustainability-report)
- [ASIC report contents and directors' declaration](https://www.asic.gov.au/regulatory-resources/sustainability-reporting/for-preparers-of-sustainability-reports/what-should-your-sustainability-report-contain)

## Folder structure

```text
forward-hackathon/
├── README.md
├── .env                           Local key/settings, ignored by Git
├── .env.example                   No real key
├── package.json / package-lock.json
├── run-pipeline.ps1               Full stored-document workflow
├── run-agent2.ps1                 Legacy secondary analysis demo / tests
├── src/
│   ├── agent1/                    PDF extraction and climate classification
│   │   ├── agent1.js
│   │   ├── sanitycheck.py
│   │   ├── data/raw/              Original demo PDFs, preserved
│   │   └── output/                Legacy standalone evidence JSON
│   ├── aasb/                      Primary AASB S2 generator
│   │   ├── rubric.js              Granular disclosure checks
│   │   ├── context.js             Version, relief and applicability metadata
│   │   ├── generateAasbS2Report.js
│   │   └── examples/reportingContext.json
│   ├── agent2/                    Legacy inactive secondary generator
│   │   ├── generateESGReport.js
│   │   ├── normalizeEvidence.js
│   │   ├── validateCitations.js    Shared exact-quotation validation
│   │   ├── rubric.js
│   │   ├── examples/
│   │   ├── tests/
│   │   └── output/                Optional standalone JSON exports
│   ├── database/
│   │   ├── db.js                  Connection, base schema and legacy accessors
│   │   ├── migrations.js          Additive typed-output migration
│   │   └── repository.js          Company/document/run/typed-report accessors
│   ├── server/                     Express API and on-demand PDF renderer
│   └── pipeline/
│       ├── processCompany.js
│       └── cli.js
├── tests/                         Context, migration, SQLite and pipeline tests
├── storage/
│   ├── database/esg_reports.db    Active local database (ignored)
│   └── backups/                   Local recovery copies (ignored DB files)
└── node_modules/                  Local dependencies (ignored)
```

## Setup

Node.js 24 is the tested runtime. From the project root:

```powershell
npm ci
```

Native dependencies must be installed for the current OS. If dependencies disappear
after switching from an older branch that tracked `node_modules`, run `npm ci` again.
The Windows launchers use Node on PATH or the existing Codex runtime; they do not
install dependencies. If a native dependency cannot load after a recent npm version
blocks installation scripts, review its listed dependency script approvals.

Create/edit the **root .env**, preserving your key. Use the model identifiers configured for your project:

```dotenv
GEMINI_API_KEY=your_actual_key
# Optional database override, relative to the project root:
# ESG_DB_PATH=storage/database/esg_reports.db
```

AASB_MODEL falls back to AGENT2_MODEL for legacy configuration compatibility.
The extractor and AASB generator use the existing Google SDK. Non-empty source
evidence is sent to Gemini. Keep the key and database on the backend.

## Manual workflow — uploads to an AASB S2 report

Run commands from the project root. Replace example IDs with those returned by your
commands; report IDs and run IDs are different identifiers.

### Create a company and upload a PDF

```powershell
.\run-pipeline.ps1 company "Example Company"
.\run-pipeline.ps1 companies
.\run-pipeline.ps1 upload 1 2025 src/agent1/data/raw/quality_holdings.pdf public
.\run-pipeline.ps1 documents 1 2025
```

Company names are case-insensitively matched for this MVP. Uploads retain actual
bytes in a SQLite BLOB, filename, SHA-256, size, year and source type (`public`,
`internal`, or `unknown`). An identical company/year/content/filename/source-type
upload is deduplicated. Metadata lists omit the BLOB.

### Provide reporting context, when known

Edit `src/aasb/examples/reportingContext.json` or create a separate context JSON:

```json
{
  "reportingPeriodStart": null,
  "reportingPeriodEnd": null,
  "earlyAdoptionOf2025Amendments": null,
  "firstAnnualPeriodApplyingAasbS2": null,
  "useScope3FirstYearRelief": null,
  "useComparativesFirstYearRelief": null,
  "companySize": { "revenueAud": null, "assetsAud": null, "employees": null },
  "confirmedNotApplicable": {}
}
```

Leave unknown values unknown. A year alone does not establish a reporting-period
start. Do not label first application as true simply because it is the first run
in this application. It means the entity's first annual period applying AASB S2.

### Process once

```powershell
.\run-pipeline.ps1 process 1 2025 --context src/aasb/examples/reportingContext.json
```

To select particular document IDs, put them after the year:

```powershell
.\run-pipeline.ps1 process 1 2025 2 3 --context src/aasb/examples/reportingContext.json
```

Context is optional: `.\run-pipeline.ps1 process 1 2025` still produces one AASB S2 readiness
output, with unknown period/version/applicability metadata where appropriate.
The command blocks while processing and returns:

```json
{
  "companyId": 1,
  "runId": 1,
  "status": "completed",
  "reportIds": { "aasbS2": 1, "esg": null },
  "files": {
    "aasbS2Report": "<absolute export directory>/aasbS2Report.json"
  }
}
```

The CLI prints file paths rather than full report bodies. The JavaScript
`processCompany` returns the AASB report in `outputs.aasbS2Report`. SQLite stores
its criteria, citations, gaps, actions, methodology, warnings and presentation
independently of the convenience export.

### Retrieve and export the AASB report

```powershell
.\run-pipeline.ps1 runs 1
.\run-pipeline.ps1 run 1 1
.\run-pipeline.ps1 report-aasb 1 1
.\run-pipeline.ps1 export-aasb 1 1 aasbS2Report.json
```

Retrieval returns metadata plus `report`; export writes the raw report JSON.
Export paths are optional and default to the two filenames shown. Exports overwrite
the chosen JSON file; they do not modify the saved report. `run` returns document
extraction snapshots, shared normalized evidence, context, stage and report IDs.

Every command also works as `npm run pipeline -- <command> <args>` or
`node src/pipeline/cli.js <command> <args>` when Node/npm are on PATH.

## Browser workflow and AASB PDF export

The browser remains independent of storage details:

```text
Browser upload/report UI
  ↓
Next.js
  ↓
Express
  ↓
Upload
  ↓
Agent 1 extraction
  ↓
AASB S2 analysis
  ↓
SQLite (canonical source)
  ↓
AASB report UI
  ↓
PDF renderer (on demand)
```

The report page downloads the AASB report through the backend:

```text
GET /api/companies/:companyId/runs/:runId/reports/aasb/pdf
```

PDFs are generated from stored typed report JSON using PDFKit. No Gemini call is
made, no PDF is stored as canonical data, and a rendering failure does not change
the pipeline run. Downloads use sanitized company-based filenames such as
`coles-aasb-s2-readiness-report.pdf`.

## Pipeline and failure semantics

```text
created → extracting → aasb_analysing → completed
                         │
                         └── handled error → failed
```

The existing `pipeline_runs.status` values are preserved (`extracting`, `analysing`,
`completed`, `failed`). `run_details.stage` stores the finer-grained stage, including
the last active stage if the run fails.

1. Validate company/year/document ownership; create the run and context record.
2. Extract each selected PDF once and save that document's evidence snapshot.
3. Normalize and persist the combined evidence once.
4. Generate the AASB S2 draft and immediately save its immutable typed output.
5. Mark completed after the AASB output is stored.

An active run does not invoke the legacy ESG generator. A handled error saves a
safe failure message and code, then rethrows the original error to the CLI. Gemini
429/`RESOURCE_EXHAUSTED` failures are classified as `AI_QUOTA_EXHAUSTED`; other
failures use `PROCESSING_FAILED`. The GET run response exposes only a structured
`{ code, message }` error and never raw provider bodies, keys or stack traces. The
processing UI shows a retry-later state for quota failures and keeps a generic
failure state for malformed PDFs, database failures and unexpected errors.
Failure-status persistence errors do not replace the original processing error.
There is no automatic restart after process termination or power loss; a killed
process can retain an in-progress status. Start a new run after resolving the
cause. Earlier successful reports are never overwritten.

## AASB S2 rubric, metadata and safeguards

The primary rubric covers granular criteria within:

- **Governance:** bodies, responsibilities, skills, information flow, decisions,
  targets, management, controls and remuneration.
- **Strategy:** risks/opportunities, physical/transition classification, horizons,
  business model/value chain, responses, transition plans, resource allocation,
  current/anticipated financial effects, planning, resilience and scenario analysis.
- **Risk management:** identification, assessment, prioritisation, monitoring,
  inputs, scenario use, likelihood/magnitude, opportunities and enterprise integration.
- **Metrics/targets:** Scopes 1/2/3, measurement/data quality/categories, exposures,
  capital deployment, carbon pricing, remuneration, targets, base/target periods,
  milestones, basis, progress and review methods.
- **General requirements:** materiality, evidence sufficiency/fair presentation,
  entity consistency, connected/financial-statement information, period, judgements,
  uncertainty, comparatives, transition reliefs and metric consistency/sources.

The model selects source excerpt IDs for each criterion and its information
elements. Code inserts source wording and locally extracts structured emissions,
targets, scenario, period, adoption and assurance facts. Unrecognized or ambiguous
values remain null with source candidates; no generated quotation is trusted.

Statuses are `present`, `partial`, `missing`, `not_applicable`, and
`requires_human_judgement` are retained for compatibility. Scoring now uses
`completenessStatus`: complete=1, evidence_found_requires_judgement=0.75,
partial=0.5, requires_human_confirmation=0.25, missing=0, not_applicable=excluded.
The rounded mean is capped at 75 for major metadata conflicts, 90 for unresolved
standard selection, and 95 for unresolved requirement judgements. It is null if
all criteria are excluded. See the detailed model documentation linked above.

A model-requested `not_applicable` becomes `requires_human_judgement`; exclusion
requires explicit human confirmation or established transition-relief metadata.
For a reviewed criterion, `confirmedNotApplicable` can contain:

```json
{
  "strategy.transitionPlan": {
    "reason": "Document the entity-specific review basis here",
    "confirmedBy": "Reviewer name or identifier"
  }
}
```

These are recorded user assertions, not authenticated director approvals. Their
basis remains in the output for review. They are not inferred from missing evidence.

**Versions:** period starts from 2025-01-01 through 2026-12-31 select `2024-09`.
Starts on/after 2027-01-01 select `2025-12`; explicit early adoption can select the
amended version for eligible earlier periods. Unknown/unsupported start dates stay
unknown. The version registry can be extended. Amended GHG/jurisdictional/financed
emissions relief details still require human review; the checklist is not a full
amendment or legal-rule engine.

**Transition relief:** confirmed first application plus a supported period and an
explicit comparative-relief election can exclude comparatives under C3. Scope 3 and its categories are only excluded when
first application is confirmed and `useScope3FirstYearRelief` is explicitly true.
Missing first-year/period inputs remain `unknown_requires_confirmation` and do not
reduce the denominator. Other relief conditions require human review.

**Applicability:** optional size data supplies conservative group hints. Two supplied
thresholds identify a likely group; timing is reported separately. Missing size
information is permitted. The output always requires professional confirmation and
lists unassessed NGER, entity/investment, and Chapter 2M tests. It never returns
`legallyRequired: true` or treats size thresholds as a complete statutory test.

## Evidence and legacy compatibility

The normalized snapshot and report evidence registers preserve evidence IDs, original
document IDs, filenames, source type, page markers and separate pooled pillar pages.
Every citation must reference an existing ID and an exact source substring of at
least 12 characters. Invalid quotes/IDs fail generation. Unsupported positive
statuses are downgraded to missing; low-confidence strong support is capped.
Quotes still require human interpretation, and source accuracy is not independently
verified. Missing evidence is not evidence of absent company practices.

The former ESG generator, rubric, tests, SQLite rows and exported JSON remain as
legacy compatibility surfaces. They are inactive and are not generated, retrieved
or presented by the current application workflow. Historical JSON is never
rewritten or deleted. Agent 1 filters for climate relevance because AASB S2 is the
active product; no OCR or broader extraction rewrite is included.

## Database and backward compatibility

The active file is `storage/database/esg_reports.db`, configurable with `ESG_DB_PATH`.
Foreign keys, WAL and a busy timeout are enabled. Uploads are BLOBs; network calls
run outside short SQLite transactions. Databases, journals and exports are ignored
by Git. Back up with SQLite's backup API; use persistent local storage for deployment.

| Table | Role |
| --- | --- |
| `companies`, `documents` | Company ownership, metadata and original upload bytes |
| `pipeline_runs`, `run_documents` | Run history and per-document extraction snapshots |
| `run_details` | New stage, explicit reporting context and shared normalized evidence |
| `report_outputs` | New typed outputs, unique per `(run_id, report_type)` |
| `reports` | Old single-report rows retained unchanged |
| `classifications`, `memos` | Teammate legacy records/accessors retained |
| `schema_migrations` | Applied typed-output migration version |

Migration 1 is additive and transactional: creates `run_details` and `report_outputs`,
copies historical `reports` rows as typed ESG outputs preserving IDs/JSON/timestamps,
and keeps the original rows. The copied outputs are marked `legacy`. Their old embedded
climate section is historical data, not a new primary AASB draft. Triggers reject
updates/deletes of typed outputs. A second startup does not recopy or rewrite data.

Use `getAasbS2Report(companyId, id)` for the active product. `getEsgReport` remains available for legacy records.
The old `getReport()` and CLI `report` only read the old `reports` table, for backward
compatibility. A new `processCompany` return value uses `reportIds`/`outputs` instead
of the previous single `id`/`report` fields; update clients accordingly.

Older root database files can still be copied to the new location on first startup
using SQLite backup. On this checkout the previously committed legacy database was
recovered, with its one classification retained and a local backup in
`storage/backups/legacy-esg_reports.db`. No original upload records are fabricated.

## Current frontend integration architecture

The current live web app uses the canonical backend storage path:

```text
Next.js frontend
  ↓ HTTP
Express API
  ↓ provider/service layer
repository.js
  ↓ SQLite
storage/database/esg_reports.db
```

The frontend never reads `storage/reports/*.json` directly and never accesses SQLite
itself. The report API continues to expose the same response contract used by the
React UI: `aasbS2Report` is returned under the run envelope; legacy `esgReport` and
`reportIds.esg` fields are returned as null for compatibility,
with the same `presentation.executiveSummary`, `keyFindings` and `priorityActions`
fields the dashboard expects.

The current demo fixture is company 2 / run 11. It is a known-good local run stored
in SQLite and served over HTTP through `/api/companies/2/runs/11`.

Generated JSON files under `storage/reports/company-<id>/run-<id>/` remain export or
inspection artefacts. They are not the source used by the live web API; SQLite is the
source of truth. `processCompany` writes typed reports into SQLite, and the report
provider reads them back for HTTP responses.

Company listing, document download and authenticated access remain future work.
Use a durable worker for long processing rather than holding an upload HTTP request.
Repository company checks are not user authentication or tenant authorization.

The primary screen should show AASB preparation status, missing disclosures, supporting
quotes and human-review actions. There is no active ESG tab.
Director/assurance/lodgement actions must remain external, never an automatic
"compliant" or "ready to lodge" badge.

## Standalone commands and tests

`.\run-agent2.ps1` still generates the secondary ESG demo JSON. It does not save to
SQLite or produce an AASB report. This is an inactive legacy command. Use the pipeline for the persisted AASB output.
The original Agent 1 CLI remains available at `src/agent1/agent1.js` and saves its
legacy classification/export. Importing `extractEvidence()` has no CLI side effects.

```powershell
.\run-agent2.ps1 -Test
# or
npm test
```

Tests cover source validation, granular sections, version/relief metadata, conditional
applicability, extraction reuse/order, independent persistence, legacy migration,
immutable reports, ownership and failure retention. SQLite tests use isolated temp
databases. Mock model results verify behavior; they are not legal/assessment accuracy
tests. Full annual reports and human assurance processes are not validated by these tests.

Limits: 25 MiB/file, 20 distinct documents/run, text PDFs only, and 500,000 normalized
evidence characters. The evidence cap is a local size guard, not a provider token
limit; model context and token quotas still apply. Evidence is never truncated to fit.
If normalization fails, extraction checkpoints remain available for the next run.
Other formats can be stored but extraction fails clearly. No
paid service, vector database, OCR, authentication, UI, distributed queue, cancellation
or automatic recovery after a killed process is included. SQLite remains the source
of truth. This task does not commit or push changes.

## Gemini pacing and retry policy

Successful `process` commands automatically export both report JSON files to
`storage/reports/company-<companyId>/run-<runId>/`. The terminal prints only a
compact completion summary with report IDs and absolute file paths, alongside
progress messages. Report bodies remain in SQLite and the exported files.
Separate export commands are for retrieving older reports or retrying file writes;
they are not required after a successful process command. If file export fails,
the completed reports remain in SQLite and can be exported without new API calls.

Report generators now select numbered source excerpts instead of writing quotations.
The application inserts exact text from the normalized evidence into the existing
`{evidenceId, quote}` report citations. Excerpts preserve all source characters;
unknown IDs fail validation. Exact matching does not establish relevance: model
assessments and selected excerpts still require human review. There is no automatic
full-report citation-correction call. Each report uses one generation request.

Excerpt IDs and AASB information-element IDs are supplied in the prompt and checked
locally, rather than duplicated as large response-schema enums. This keeps the
schema compact for long documents and avoids a potential source of Gemini
`400 INVALID_ARGUMENT` schema-complexity errors. Unknown IDs and invented quotations
still fail validation; evidence text and scoring rules are unchanged.
The detailed AASB request allows up to five minutes for generation; a client timeout
does not produce or persist a partial report.

The shared live requester stops at 20 physical API attempts per process, including
transport retries across extraction and AASB generation. It does not know usage from
earlier processes, other applications or other keys on the project, so this is not
a guarantee of remaining daily quota. Daily quota errors still stop immediately.
Existing extraction checkpoints are unchanged and remain reusable.

Agent 1 now groups up to eight independent chunks into each request, with a
48,000-character grouping limit (a single oversized page remains intact).
Each chunk retains its text and page markers. Responses must contain every input
chunk ID exactly once and valid classification fields; malformed batches fail
without inventing evidence. `AGENT1_BATCH_SIZE=1` restores individual requests;
the default is 8, with a supported range of 1–16. This is ordinary request grouping,
not Google's asynchronous Batch API. It reduces request count, not total input
tokens, so token-per-minute limits can still apply.

The stored-document pipeline commits validated classifications to SQLite's
`extraction_checkpoints` table before the next request. Repeating `process` creates
a new audit run and reuses matching classifications from the same document,
including work saved before a failure. Cache keys include model, prompt, examples,
classifier version and exact chunk text/page data. Changed inputs are reclassified.
Standalone Agent 1 does not persist these checkpoints. Report generation still
runs anew; historical reports remain immutable. Earlier failed runs cannot recover
classifications that the old code never saved.

Check request counts offline before starting (no Gemini calls or new pipeline run):

```powershell
.\run-pipeline.ps1 estimate 2 2026
# Optional document IDs: estimate 2 2026 2
# Once provider quota is available, reuse the existing upload:
.\run-pipeline.ps1 process 2 2026 --context src/aasb/examples/reportingContext.json
```

For the locally uploaded Coles PDF, the estimate is 96 chunks, 13 extraction
requests and 2 report requests: approximately 15 calls instead of 98. This excludes
retries and other project usage and is not a guarantee of available quota or final
report success. Use reporting-context dates appropriate to the actual financial
period; the example context is a template.

An error containing `GenerateRequestsPerDayPerProjectPerModel-FreeTier` with limit
20 is a daily allowance failure. Its short generic retry delay does not restore
that allowance. Google resets daily requests at midnight Pacific time; wait for
the reset before retrying. You do not need to re-upload the PDF or replace the key.

All active live calls (Agent 1 and AASB) share `src/llm/gemini.js` in one Node process.
Provider quotas apply to project/model usage, including RPM, input TPM and daily
requests; pacing does not create additional quota. See
[Google's rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

```dotenv
GEMINI_MIN_REQUEST_INTERVAL_MS=15000
GEMINI_MAX_RETRIES=3
GEMINI_MAX_RETRY_DELAY_MS=60000
```

The first call starts immediately. Subsequent call/retry starts are at least the
configured interval apart. SDK-level retries are explicitly disabled; the helper
owns the retry budget. The default allows an initial attempt plus three retries.

Retryable failures: 429/RESOURCE_EXHAUSTED, 408, 5xx and recognized transient network
codes. Bad requests, keys, permissions, model configuration and invalid generated
JSON do not enter an indiscriminate retry loop. Provider RetryInfo/retryDelay and
Retry-After seconds/date are respected with a 250 ms safety buffer. Otherwise the
helper uses 2s, 4s, 8s... exponential delays capped at 30s, plus up to 500 ms jitter;
the pacing interval still applies if it is longer.

An explicit daily-quota failure stops further calls in that process. A provider
wait above the configured retry-delay budget fails rather than retrying early;
quota-related long waits also stop further calls in that process. Exhausted normal
transient retries surface the original error with a CLI hint and mark the run failed.
The helper never loops indefinitely or attempts to bypass quota. It has no automatic
daily-reset scheduler. Start a new process/run when quota becomes available again.

This queue is process-local, not distributed. Multiple CLIs/workers or other apps on
the same project can still exceed its quota. Use one worker for the hackathon; no
large chunk-size increase or provenance reduction was introduced.

The test suite uses fake clocks for pacing/retry scenarios and injected model
clients elsewhere. It covers successful requests, provider delays, backoff/jitter,
retry caps, permanent errors, queue recovery, retained extraction after quota failure
and a subsequent successful run using the same stored documents. One test deliberately
makes SQLite's failed-status update throw; its expected diagnostic confirms that
the original processing exception is preserved.

## Historical verification archive — inactive two-report architecture

Phase 1 was completed and all 19 tests passed before Phase 2 implementation began.
The final 28 tests passed. A live one-page PDF was extracted once, generated both
typed reports, persisted them to an isolated SQLite database, and exported both
files. Export JSON matched stored JSON; foreign-key checks were empty and SQLite
integrity was `ok`. The AASB result had 64 criteria and version `2024-09`; its draft,
human declaration and non-lodgement-ready flags were verified. The ESG export had
no embedded AASB section. Live testing did not process the user's full Coles report.

| File | Change |
| --- | --- |
| `.env.example` | AASB model and shared pacing/retry configuration |
| `.gitignore` | Ignore the primary AASB export filename |
| `README.md` | Primary/secondary architecture, commands, schema, metadata, retries and review boundaries |
| `src/agent1/README.md` | Shared-extraction and centralized pacing instructions |
| `src/agent1/agent1.js` | Route API calls through the shared request queue; preserve extraction/chunking |
| `src/agent2/README.md` | Secondary ESG contract and backward-compatible score alias |
| `src/agent2/generateESGReport.js` | Remove embedded AASB output, share normalized input and request handling |
| `src/agent2/normalizeEvidence.js` | Document the shared snapshot contract |
| `src/agent2/rubric.js` | Keep the nine ESG criteria; remove the four embedded climate criteria |
| `src/agent2/validateCitations.js` | New shared exact-quote/ID validation |
| `src/agent2/tests/generateESGReport.test.js` | Updated secondary-output assertions |
| `src/aasb/context.js` | New version, explicit relief and conditional applicability metadata |
| `src/aasb/rubric.js` | New 64-criterion AASB preparation rubric and structured-response schema |
| `src/aasb/generateAasbS2Report.js` | New primary draft generator, evidence checks, scoring and human-review fields |
| `src/aasb/examples/reportingContext.json` | New optional context example with unknown size/first-year inputs |
| `src/database/db.js` | Invoke additive migration, preserve legacy connection and tables |
| `src/database/migrations.js` | New typed-output and stage/context schema with immutable outputs |
| `src/database/repository.js` | Typed retrieval/storage, shared snapshot and stages; preserve legacy accessor |
| `src/pipeline/processCompany.js` | Extract once, save AASB first, save ESG second, preserve partial success/errors |
| `src/pipeline/cli.js` | Context input, separate report retrieval and exports, useful quota hints |
| `src/llm/gemini.js` | New centralized queue, provider delays, transient retries, backoff and retry budget |
| `tests/aasb.test.js` | New primary-schema, citation, version, relief and applicability tests |
| `tests/gemini.test.js` | New deterministic fake-clock pacing/retry tests |
| `tests/migrations.test.js` | New legacy-preservation and immutable-output migration test |
| `tests/pipeline.test.js` | Two-output order/provenance, partial failure, exhausted quota and later recovery |

No Express/React, paid service, package dependency or SQLite replacement was added.
The existing untracked `Coles_Annual_Report_2026.pdf` is user data, not an implementation
change. No commit, merge or push was performed.

## Local verification and manual testing (AASB-only)

All three package areas already have installed dependencies matching their lockfiles,
including PDFKit. No dependency upgrade is needed for this change.

Run the offline checks from the repository root:

```powershell
npm test
node --test src/server/tests/reports.test.js
npm --prefix src/frontend run typecheck
npm --prefix src/frontend run build
```

Server tests use a disposable SQLite database seeded from a regression fixture; they
do not add runs or documents to the local company database. Model tests use mocks.
Stop the frontend dev server before building, because both use the same .next directory.
Then use two terminals:

```powershell
# Terminal 1
npm --prefix src/server run dev
# Terminal 2
npm --prefix src/frontend run dev
```

- Home: http://localhost:3000
- Upload: http://localhost:3000/upload
- API health: http://localhost:4000/api/ping
- Regression report: http://localhost:3000/report/2/11
- Regression API: http://localhost:4000/api/companies/2/runs/11
- PDF: http://localhost:4000/api/companies/2/runs/11/reports/aasb/pdf

The regression URLs require company 2 / run 11 in your local SQLite database.
Nothing in application logic hard-codes that run. Opening these URLs uses no Gemini calls.
Uploading and generating a new report does consume quota.

Processing polls only while unfinished, cancels in-flight requests when leaving the
page, and stops on completion or failure. AI_QUOTA_EXHAUSTED produces a safe retry-later
message; saved uploads and extraction checkpoints remain. After quota resets, use the
CLI process command for that company/year to reuse saved evidence without re-uploading.
The browser has no resume button yet. Processing jobs do not automatically resume after
a server restart; persisted progress is retained, but a new run must be started.

PDF flow: SQLite → typed report repository → buildAasbPdfViewModel → PDFKit → HTTP.
The view model translates statuses and field labels, consolidates actions by topic and
priority, and summarises structured arrays as record counts instead of dumping JSON.
All requirement-level assessments and concise source/page references remain in the PDF;
full structured records and validated quotations remain unchanged in SQLite/JSON.
Measured content blocks and a reserved footer margin prevent accidental footer pages.
The web report also exposes expandable detail for all five AASB sections.
No score, citation, stored report, or historical ESG row is rewritten for presentation.

Deployment is still pending. Before public use, add authentication and company-level
authorization, durable job execution/recovery, persistent SQLite storage and backups,
production URL/CORS configuration, and an agreed Gemini quota/billing arrangement.
