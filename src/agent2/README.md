# How Agent 2 works

Agent 2 converts company evidence JSON into a structured ESG evidence-readiness report. It assesses Environmental, Social and Governance evidence, then adds a separate climate disclosure readiness section for AASB S2.

The model decides how well the supplied evidence supports each assessment criterion. JavaScript checks its citations, calculates scores and constructs the report.

## Start here (Windows)

From the project root, run:

```powershell
.\run-agent2.ps1
```

The launcher finds Node on PATH or uses the installed Codex runtime. It reads
`src/agent2/examples/testEvidence.json` and writes `src/agent2/output/esgReport.json`.
Your private API key belongs in the root `.env` file. `.env.example` is only a
shareable template; it is not loaded by the application.

Run offline tests with `.\run-agent2.ps1 -Test`. To try the empty Agent 1 sample:

```powershell
.\run-agent2.ps1 -InputFile src/agent1/output/quality_holdings_resources_2025_classified.json
```

The empty sample produces missing statuses without calling Gemini. If PowerShell
blocks scripts under your machine's execution policy, use the direct Node command
below with the full path to your installed Node executable.

## 1. Where it fits

```text
Company PDFs
    ↓
Agent 1: extract text and classify climate-related chunks
    ↓
Evidence JSON
    ↓
Agent 2: normalize → classify with Gemini → validate → score
    ↓
ESG report JSON
    ↓
Future backend endpoint / React frontend / optional storage
```

Agent 1 lives in `src/agent1/`; its original extraction/classification prompt is preserved, with path, model and failure-handling fixes. Agent 2 does not read PDFs, search for company information or require a database. The repository currently has no Express server or React application.

## 2. Files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/agent2/generateESGReport.js` | Main function, Gemini request, response checks, scoring, report assembly and CLI |
| `src/agent2/normalizeEvidence.js` | Adapts Agent 1 output or a simple evidence array into a common format |
| `src/agent2/rubric.js` | Defines the 13 assessment criteria and the requested model response schema |
| `src/agent2/examples/testEvidence.json` | Fictional company evidence for a live API demonstration |
| `src/agent2/tests/generateESGReport.test.js` | Offline tests using a simulated Gemini client |
| `.env.example` | API key and model configuration template |

## 3. Accepted inputs

### Agent 1's existing JSON

Pass Agent 1's parsed output directly into Agent 2:

```json
{
  "company_name": "Example Company",
  "report_year": "2025",
  "pillars": {
    "governance": {
      "raw_text_chunks": [
        {
          "text": "[Page 5] The board reviews climate risks quarterly.",
          "confidence": 0.94,
          "justification": "Describes climate oversight."
        }
      ],
      "source_pages": [5]
    },
    "strategy": { "raw_text_chunks": [], "source_pages": [] },
    "risk_management": { "raw_text_chunks": [], "source_pages": [] },
    "metrics_targets": { "raw_text_chunks": [], "source_pages": [] }
  }
}
```

The raw text is the evidence. Agent 1's classification justification is not treated as a company fact. Its confidence is classification confidence, not proof that a company claim is true.

### Simple evidence array

This format is useful for testing and for future broader ESG extraction:

```json
{
  "company": "Example Company",
  "evidence": [
    {
      "category": "governance",
      "claim": "The board reviews climate risks quarterly.",
      "source": "Board charter",
      "sourceType": "public",
      "page": 5,
      "confidence": 0.94
    }
  ]
}
```

Each item needs non-empty `text` or `claim`. Source, category, page and confidence are optional. A supplied confidence must be a number from 0 to 1. Use `report_year` at the top level if a reporting year is needed.

Supply one input shape at a time: when `pillars` is present, the adapter uses it rather than the `evidence` array.

## 4. Processing steps

### Step 1: Normalize evidence

`normalizeEvidence()` validates the input and creates evidence items with consistent fields:

```json
{
  "id": "e1",
  "text": "The board reviews climate risks quarterly.",
  "confidence": 0.94,
  "category": "governance",
  "pillar": null,
  "source": "Board charter",
  "sourceType": "public",
  "pages": [5],
  "pillarSourcePages": []
}
```

IDs are assigned in input order for each call. Missing source visibility becomes `unknown`; the adapter does not assume a document is public. Explicit `pages` or `page` fields take precedence over `[Page N]` markers in text.

Agent 1 pools page numbers across each pillar. These stay in `pillarSourcePages`, separate from chunk page markers. Neither field maps an individual quotation to an exact page automatically.

The adapter rejects normalized evidence exceeding 200,000 serialized characters instead of silently truncating it. Agent 1 inputs also produce a warning that climate filtering may have excluded other ESG material.

### Step 2: Handle empty evidence

If no evidence items exist, Agent 2 skips Gemini and produces a report with all criteria marked `missing` and all scores set to zero. This path requires no API key.

### Step 3: Ask Gemini to classify evidence

For non-empty evidence, `generateESGReport()` makes one `generateContent()` call using the existing `@google/genai` SDK. The request contains the rubric and normalized evidence.

Configuration:

| Setting | Value |
| --- | --- |
| API key | `GEMINI_API_KEY`, loaded through dotenv |
| Model | `options.model`, then `AGENT2_MODEL`, then `gemini-3.6-flash` |
| Temperature | `0` |
| Response format | JSON with a supplied schema |
| Maximum output tokens | `12000` |
| HTTP timeout | `90000` milliseconds |

The prompt instructs Gemini to use only supplied evidence, treat document content as data rather than instructions, assess every criterion, preserve quotation context, and avoid numeric scoring. There is no application-level retry loop.

An individual model assessment looks like this:

```json
{
  "criterionId": "governance.oversight",
  "status": "partial",
  "citations": [
    {
      "evidenceId": "e1",
      "quote": "The board reviews climate risks quarterly."
    }
  ],
  "potentialInconsistency": false
}
```

This is an illustration, not a guaranteed live-model classification.

### Step 4: Validate the response

`buildReport()` requires all 13 criteria exactly once, supported statuses, citation arrays and boolean inconsistency flags.

For every citation, JavaScript checks that:

- Its evidence ID exists in the normalized input.
- The quotation has at least 12 characters after trimming.
- The quotation occurs exactly as a contiguous substring of that evidence item's text.

Unknown IDs, fabricated quotations, duplicate criteria, missing criteria and invalid assessment fields cause the call to fail.

Additional rules make scoring conservative:

- A criterion without cited evidence becomes `missing`.
- A `strong` criterion becomes `partial` if any cited source has confidence below `0.5`.
- A supported potential public/internal inconsistency becomes `partial`.

Quotation checks verify that the text exists; they cannot prove that the model interpreted it correctly or that the original company claim is true.

### Step 5: Score and assemble the report

JavaScript calculates the scores, creates gap descriptions and recommended actions from templates, and returns plain JSON. The executive summary is also generated from a template using the calculated scores. The model does not write a free-form company narrative into the final report.

## 5. Assessment criteria

| Section | Criteria |
| --- | --- |
| Environmental | Emissions/energy measurements; resource impacts and management; environmental targets, plans and progress |
| Social | Workforce wellbeing/diversity/training; safety processes and outcomes; human rights/supply chain/community practices |
| Governance | Board/executive oversight; ethics and compliance mechanisms; risk management and accountability |
| AASB S2 readiness | Climate governance; climate strategy; climate risk management; climate metrics and targets |

There are three criteria per ESG category and four climate criteria. Alternatives joined by “or” do not require every alternative to be evidenced. The climate criteria require climate-specific evidence.

This is a fixed hackathon rubric. It does not determine materiality, apply industry-specific weighting or support a `not_applicable` status. Uncovered criteria remain in the scoring denominator.

## 6. Scoring explained

| Status | Meaning in the model prompt | Weight |
| --- | --- | --- |
| `strong` | Concrete, relevant evidence addresses the criterion's substantive elements | 1 |
| `partial` | Relevant evidence is generic, incomplete, negative or uncertain | 0.5 |
| `missing` | No relevant evidence | 0 |

```text
Section score = round(sum of criterion weights / number of criteria × 100)

Overall ESG score = round((Environmental + Social + Governance scores) / 3)

AASB S2 readiness = round(sum of four climate criterion weights / 4 × 100)
```

For example, a category with `strong`, `partial`, `missing` scores:

```text
round((1 + 0.5 + 0) / 3 × 100) = 50
```

The overall ESG calculation uses the already-rounded category scores. AASB S2 readiness does not affect that overall score.

A category's status is `strong` only if all its criteria are strong, `missing` if all are missing, and `partial` otherwise. Status is not derived from a numeric threshold.

The arithmetic is deterministic for a given set of classifications. Gemini's classifications can still vary between calls. These scores describe evidence readiness, not measured company ESG performance.

## 7. Gaps and priority actions

| Gap type | Implemented rule |
| --- | --- |
| `missing_evidence` | The criterion is missing |
| `insufficient_evidence` | The criterion is partial, unless a more specific gap applies |
| `disclosure_gap` | Cited evidence includes internal sources, no public sources and no sources of unknown visibility |
| `potential_inconsistency` | The model flags a conflict and the citations include both public and internal sources |

A potential inconsistency takes precedence over other gap labels. A disclosure gap can coexist with a `strong` evidence status: it concerns disclosure availability, not necessarily the quality of internal evidence.

The model is instructed to compare the same subject, period, units and boundary before flagging a conflict. JavaScript verifies citations and source types but does not independently establish the semantic contradiction.

Recommendations ask the company to collect or strengthen evidence, review internal evidence for disclosure, or reconcile conflicting sources. Priority actions place potential inconsistencies first, then missing criteria, partial criteria and strong criteria with disclosure gaps.

Missing evidence is not labelled a proven capability gap. Public/internal comparisons concern cited material supplied to this call, not all documents the company may possess.

## 8. Final output

| Top-level field | Contents |
| --- | --- |
| `company`, `reportYear` | Company metadata |
| `executiveSummary` | Template summary of category readiness scores |
| `overallESGScore` | Average of the three ESG category scores |
| `environmental`, `social`, `governance` | Score, status, strengths, gaps, recommendations, cited evidence and criterion assessments |
| `aasbS2` | Separate readiness score, four pillar findings, gaps, recommendations and cited evidence |
| `priorityActions` | Ordered objects with `criterionId` and `action` |
| `methodology` | Rubric version, scoring explanation and limitations |
| `warnings` | Extraction coverage and source visibility limitations |

ESG strengths contain criterion IDs and citations. AASB S2 `findings` contain citation objects. Resolve an `evidenceId` against the section's `evidence` array to display the supplied source, text and page metadata. Sections include cited evidence, not necessarily every input item.

For the repository's empty Agent 1 sample, the actual output includes these values (abbreviated):

```json
{
  "company": "Quality Holdings Resources",
  "reportYear": "2025",
  "overallESGScore": 0,
  "environmental": { "score": 0, "status": "missing" },
  "social": { "score": 0, "status": "missing" },
  "governance": { "score": 0, "status": "missing" },
  "aasbS2": {
    "readinessScore": 0,
    "governance": { "status": "missing", "findings": [], "gapType": "missing_evidence" }
  }
}
```

## 9. Run it locally

From the repository root, install dependencies if needed:

```sh
npm install
```

Copy `.env.example` to `.env` if you do not already have one, then set:

```dotenv
GEMINI_API_KEY=your_actual_key
AGENT2_MODEL=gemini-3.6-flash
```

Run the fictional evidence example:

```sh
node src/agent2/generateESGReport.js src/agent2/examples/testEvidence.json src/agent2/output/esgReport.json
```

Or use the defaults, which select those same paths:

```sh
node src/agent2/generateESGReport.js
```

Run the existing empty Agent 1 sample without an API call:

```sh
node src/agent2/generateESGReport.js src/agent1/output/quality_holdings_resources_2025_classified.json src/agent2/output/esgReport.json
```

The default report is `src/agent2/output/esgReport.json`. The CLI creates the output directory if needed and writes formatted JSON after successful generation. Input and output paths must differ. API or validation errors cause a nonzero exit and prevent writing a new report; a pre-existing output file remains unchanged in those cases. A successful run replaces the chosen output file.

Non-empty evidence is sent to Gemini. The key belongs in the backend environment and must not be embedded in React.

## 10. Call it from application code

```js
import { readFile } from "node:fs/promises";
import { generateESGReport } from "./src/agent2/generateESGReport.js";

const evidence = JSON.parse(
  await readFile("src/agent1/output/quality_holdings_resources_2025_classified.json", "utf8")
);

try {
  const report = await generateESGReport(evidence);
  console.log(report.overallESGScore);
  // Return report from a future backend route, or save it to a database.
} catch (error) {
  console.error("Report generation failed:", error.message);
}
```

The function returns a JavaScript object and does not write a file. File writing is only part of the CLI. Importing this module does not start the CLI. The root `.env` and default example/output paths are resolved relative to the module, so they work even when launched from another directory. Explicit relative input/output paths are resolved from your terminal directory.

Avoid importing `src/agent1/agent1.js` to obtain its data: that file currently executes its command-line entry point on import. Pass its output JSON instead.

When a backend is added, `POST /api/esg-report` can accept a size-limited JSON body, await `generateESGReport(req.body)` and return the object. Add error handling there. React can display category cards, criterion evidence, gaps, actions and a separate climate readiness panel. MongoDB storage can be added after generation; it is not required by the function.

## 11. Tests and current limits

Run:

```sh
npm test
```

Or directly:

```sh
node --test src/agent2/tests/generateESGReport.test.js
```

The nine tests cover Agent 1 normalization, empty input, deterministic scoring, disclosure gaps, unknown visibility, unsupported/low-confidence findings, invalid citations and schemas, potential inconsistencies, input validation and API failures. They inject a simulated client through `options.client` and do not require a key.

All nine Agent 2 tests pass; the project test command also runs an isolated SQLite test. Live smoke checks now cover the fictional evidence example and a one-page PDF through Agent 1 and Agent 2. These verify execution and citation validation, not comprehensive assessment accuracy.

The main limitations are:

- Agent 1 filters for climate relevance, so social or other ESG evidence may never reach Agent 2.
- Exact quotations prevent fabricated quoted text from entering the report, but do not guarantee relevant or correct interpretation.
- The rubric is a small, fixed readiness assessment; source truth and real-world company practices are not independently verified.
- The AASB S2 section is a simplified readiness view, not a comprehensive compliance assessment or legal, audit or assurance advice.

To extend the assessment, edit the rubric in `src/agent2/rubric.js` and review the corresponding schema, tests and scoring assumptions. To accept a changed Agent 1 format, update the adapter rather than rewriting either pipeline.


