# Agent 1: shared evidence extraction

This is the teammate's PDF extraction and climate pillar-classification pipeline.
Its chunking, page provenance and classification prompt are preserved. The full
pipeline extracts each selected PDF once, then reuses the result for the primary
AASB S2 draft and the secondary ESG report.

## Callable service

```js
import { extractEvidence } from "./src/agent1/agent1.js";
const evidence = await extractEvidence(pdfBuffer, "Example Company", "2025");
```

The first argument can be PDF bytes or a file path. Importing the module does not
run its CLI or open SQLite. The service returns `{ company_name, report_year, pillars }`.
Each pillar contains raw text chunks, confidence/justification and pooled page numbers.
The full pipeline stores these snapshots and attaches original document IDs and source
metadata before one shared normalization step.

No OCR is implemented: PDFs without extractable text fail clearly. Original demo
PDFs remain in `data/raw/`; company uploads are stored as SQLite BLOBs instead.

## Standalone CLI

From the project root, with Node on PATH:

```powershell
node src/agent1/agent1.js src/agent1/data/raw/quality_holdings.pdf "Quality Holdings Resources" 2025
```

Or `npm run agent1 -- <pdf_path> "<company_name>" <report_year>`.
The CLI preserves the legacy classification upsert through `src/database/db.js`
and exports JSON to `src/agent1/output/`. A repeated company/year replaces this
standalone export/legacy row. Full pipeline runs use immutable typed report history.

## Gemini pacing and errors

`AGENT1_MODEL` defaults to `gemini-3.6-flash`; the key comes from root `.env`.
All live model calls use `src/llm/gemini.js`. The default interval is 15 seconds;
configure `GEMINI_MIN_REQUEST_INTERVAL_MS`, `GEMINI_MAX_RETRIES` and
`GEMINI_MAX_RETRY_DELAY_MS` centrally. SDK retries are disabled to prevent hidden
bursts. Only transient failures retry; provider delays take precedence over fallback
backoff. Invalid classification JSON is not treated as valid empty evidence.

Mocked clients do not wait 15 seconds. Tests can pass an explicit fake-clock
`requester` to verify pacing and retry caps. The queue is process-local; run one
worker on a low-tier project, not many concurrent CLIs sharing the same quota.

## Python helper

With Python and `pdfplumber` installed, `python src/agent1/sanitycheck.py` previews the
sample PDF's first page. This helper is not required by the Node pipeline.

See the [project README](../../README.md) for upload commands, processing, typed
report retrieval and frontend integration plans.
# Quota recovery

Classification groups up to eight independent chunks per request by default
(`AGENT1_BATCH_SIZE`, range 1–16), preserving original text and page markers.
The stored-upload pipeline saves each validated chunk in SQLite and reuses it
when the same process command is repeated. Run `./run-pipeline.ps1 estimate
<companyId> <year>` from the project root for offline request counts. Standalone
Agent 1 does not persist checkpoints. Daily quota exhaustion still requires the
provider reset; batching does not increase your allowance.
