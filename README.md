# REPOSITORY: forward-hackathon

## Agent 2: ESG evidence assessment

Agent 1 remains unchanged in `agent1.js`. There is currently no `src/`, Express
server, React application or configured database. Both agents use ES modules,
`@google/genai`, and `dotenv` with `GEMINI_API_KEY`. Agent 2 adds no dependencies.

### Run

```sh
npm install
# Copy .env.example to .env and enter your Gemini API key.
npm run agent2
# Or consume Agent 1's existing schema directly:
node generateESGReport.js quality_holdings_resources_2025_classified.json esgReport.json
npm test
```

The default input is `agent2/testEvidence.json` (fictional evidence); the default
output is `esgReport.json`. The checked-in Agent 1 output is empty, so it produces
an all-missing report without a key or network call. Non-empty evidence requires
a key and sends its text to Gemini. `AGENT2_MODEL` configures Agent 2 only; its
default is `gemini-2.5-flash`. API, schema and citation errors fail the call and
do not write a new report. A pre-existing output file is unchanged on failure.

### Input and integration

```js
import { generateESGReport } from "./generateESGReport.js";
const report = await generateESGReport({
  company: "Example Company",
  evidence: [{
    claim: "The board reviews climate risks quarterly.",
    source: "Board charter", sourceType: "public", page: 5, confidence: 0.94
  }]
});
```

Agent 1 input is accepted without conversion:
`{ company_name, report_year, pillars: { governance, strategy, risk_management,
metrics_targets } }`, where each pillar contains `raw_text_chunks` (objects with
`text`, `confidence`, `justification`) and `source_pages`. Agent 2 uses raw text,
not classification justifications as facts. Source visibility defaults to
`unknown`; public/internal is never inferred from the pillar. Exact page markers
inside chunks become `pages`; pooled pages remain `pillarSourcePages`.

Connect Agent 1 by passing its parsed output to `generateESGReport`. No import of
`agent1.js` is needed (it currently executes its CLI on import). Once an Express
server exists, add `POST /api/esg-report`, parse a size-limited JSON body, await
this function, return its result, and handle errors in server middleware. Keep
the Gemini key on the backend. React can render the three category sections,
their criteria/citations, priority actions and separate `aasbS2` section. The
returned plain JSON can later be persisted to MongoDB without changing Agent 2.

### Output and scoring

For the checked-in empty Agent 1 sample, the result includes the following
values (abbreviated; actual sections also have criteria, evidence and actions):

```json
{
  "company": "Quality Holdings Resources",
  "overallESGScore": 0,
  "environmental": { "score": 0, "status": "missing" },
  "social": { "score": 0, "status": "missing" },
  "governance": { "score": 0, "status": "missing" },
  "aasbS2": { "readinessScore": 0 }
}
```

The rubric has three broad criteria per ESG category and four climate criteria.
Strong = 1, partial = 0.5, missing = 0. Each section averages its criteria onto
0–100; the overall score averages the three rounded ESG section scores. Climate
does not affect the overall score. Section status is strong only when all its
criteria are strong, missing when all are missing, otherwise partial.

These are **evidence-readiness scores**, not environmental/social performance
ratings. Missing evidence does not prove a capability gap. Social material may
be missing because Agent 1 currently filters for climate relevance. The rubric
is an MVP baseline, not a comprehensive or industry-specific checklist.

The LLM classifies sufficiency and supplies exact quotes/IDs. JavaScript rejects
invented citations and malformed/incomplete results, removes unsupported strong
statuses and caps low-confidence support at partial. Findings contain verified
quotations rather than model-written factual summaries. Exact quotation checks
cannot prove relevance or detect every misinterpretation; human review remains
necessary, and live model classifications may vary.

Internal-only cited evidence flags a possible disclosure gap (absence is limited
to supplied evidence). Public/internal conflicts require both sources and remain
potential inconsistencies for review. No evidence alone is labelled a proven
capability gap. Unknown source visibility prevents unsupported comparisons.

AASB S2 covers governance, strategy, risk management, and metrics/targets:
[official standard](https://standards.aasb.gov.au/aasb-s2-sep-2024).
This small readiness section is not a legal compliance check, audit or assurance
opinion. It does not assess every disclosure requirement or reporting obligation.

Tests use an injected Gemini client and exercise the real adapter, request,
validation and scoring. They do not require a key and are not live-model accuracy
tests. Inputs larger than 200,000 normalized evidence characters are rejected
explicitly, never silently truncated.
