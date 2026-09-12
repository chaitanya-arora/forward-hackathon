# Secondary ESG assessment

The primary product is now the separate AASB S2 preparation/readiness draft in
`src/aasb/`. This folder produces the secondary Environmental, Social and Governance
assessment. New ESG JSON no longer embeds an AASB S2 section.

See the [project README](../../README.md) for the complete stored-document workflow,
configuration, database schema, AASB metadata, typed retrieval and both exports.

## Standalone demo

From the project root:

```powershell
.\run-agent2.ps1
```

Default input: `src/agent2/examples/testEvidence.json`.
Default export: `src/agent2/output/esgReport.json`.
This standalone command does not persist to SQLite or generate the primary draft.

```js
import { generateESGReport } from "./src/agent2/generateESGReport.js";
const report = await generateESGReport({
  company: "Example Company",
  evidence: [{
    claim: "The board reviews climate risks quarterly.",
    source: "Board charter", sourceType: "public", page: 5
  }]
});
```

Agent 1's `{ company_name, report_year, pillars }` shape is accepted directly.
The full pipeline calls `generateESGFromNormalized` with the same persisted snapshot
used by AASB S2, after the primary draft is generated and saved.

## Files

| File | Responsibility |
| --- | --- |
| `generateESGReport.js` | Gemini request, validated assessments, scoring, output and CLI |
| `normalizeEvidence.js` | Shared evidence IDs, document/source/page metadata and input checks |
| `validateCitations.js` | Shared exact-quote and evidence-ID validation |
| `rubric.js` | Nine ESG criteria and structured-response schema |
| `tests/` | Existing input, validation, source-comparison and scoring tests |

## Output and safeguards

`reportType` is `ESG_READINESS`; `priority` is `secondary`.
`overallESGReadinessScore` is the preferred score name. `overallESGScore` is retained
as a deprecated alias. Category sections contain scores/statuses, strengths, gaps,
recommendations, criteria and original cited evidence. There is no `aasbS2` property.

Strong = 1, partial = 0.5, missing = 0. Each category averages its three criteria
onto 0–100, and the overall score averages the three rounded category scores.
Category status is strong only when all criteria are strong, missing when all are
missing, and partial otherwise. Scores are evidence readiness, not performance.

Every accepted citation needs an existing evidence ID and an exact substring of at
least 12 characters. Unsupported positive statuses become missing. Low-confidence
strong support is capped at partial. Internal-only evidence can flag a disclosure
gap; a cited public/internal conflict can flag a potential inconsistency. No missing
input alone proves a capability gap. Exact quotations still require human review.

Empty inputs generate all-missing results without an API call. Live Gemini requests
share `src/llm/gemini.js` with Agent 1 and the AASB generator. Injected clients skip
real pacing unless a fake-clock requester is explicitly supplied for tests.

Agent 1 filters for climate relevance, which can limit evidence for the secondary
social assessment. Inputs above 500,000 normalized evidence characters are rejected
without truncation. This application guard is separate from provider token limits.
Run all tests with `.\run-agent2.ps1 -Test` or `npm test`.
