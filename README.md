# GreenScreen

Company climate documentation in, structured AASB S2 / TCFD readiness report out.

A company without a dedicated sustainability team already holds the evidence an AASB S2 or TCFD
assessment needs — it is just scattered across annual reports, board policies and internal memos.
Upload any mix of documents; every claim in the generated report is traced to the document and page
it came from.

Evidence is **pooled**, never compared. Each additional document strengthens the same assessment —
there is no cross-source discrepancy detection.

## Layout

```
packages/contract   Zod schemas — the single source of truth for the data contract.
                    The same schemas constrain the model's output AND type the frontend.
apps/api            Express. Agent 1 (extraction) + Agent 2 (report generation).
apps/web            Next.js. The report view is the hero screen.
```

## Setup

```bash
npm install
npm run build -w @climate/contract      # the contract must be built before either app
cp apps/api/.env.example apps/api/.env  # add your ANTHROPIC_API_KEY
```

`ANTHROPIC_API_KEY` is required. Without `MONGODB_URI`, reports are stored in
`apps/api/.data/latest.json` and everything works locally.

## Run

```bash
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

`http://localhost:3000/report/preview` renders the locked mock report and needs **no API key** —
useful for working on the report view.

To work on the processing screen without spending model calls, start a synthetic in-flight job
(dev only — the route does not exist when `NODE_ENV=production`):

```bash
curl -X POST localhost:4000/api/dev/mock-job    # → { "jobId": "..." }
# then open http://localhost:3000/processing/<jobId>
```

## Design

Two surfaces, deliberately. The journey — landing, upload, processing — is a dark, focused
workspace; the report is paper, in every theme, because it is a document and prints as one. The
report arriving bright at the end of a dark flow is the payoff.

Numbers are never animated at the cost of being wrong: the report's scores are in the
server-rendered HTML, so a failed bundle shows the true score rather than `0/100`, and the live
evidence tally on the processing screen renders the pipeline's exact count with no easing.

## Validating the pipeline

Run each agent on its own before trusting the whole chain.

```bash
# Agent 1 alone — prints evidence per pillar, mean confidence, and drop counts.
npm run extract -w @climate/api -- path/to/report.pdf "2025 Sustainability Report"

# Agent 2 against Agent 1's saved real output — checks every citation resolves.
npm run report -w @climate/api

# Validate any report JSON against the contract.
npm run validate -w @climate/api -- apps/web/mock/report.json
```

Sanity bar for Agent 1: non-zero evidence in at least three of four pillars, with confidence
values spread rather than uniformly high.

## The demo beat

Run on the public document alone and record the pillar scores, then add a second document and
re-run. Scores rise and new citations appear, because more of the company's material is now in
evidence. Pillar scores are computed deterministically in
[apps/api/src/agent2/score.ts](apps/api/src/agent2/score.ts) — from the completeness rating,
evidence count and mean confidence — so that improvement is reproducible rather than model noise.

## API

| Route | |
|---|---|
| `POST /api/generate-report` | multipart: `files` (any number) + optional `labels`. Returns `{ jobId }`. |
| `GET /api/report/status/:jobId` | `{ stage, detail, done, result? }`. Stages are real, written by the pipeline. |
| `GET /api/report/latest` | The most recently generated report. |
| `GET /api/ping` | Health check. |

Uploaded files are processed and discarded — only extracted evidence persists.

## Deploying (Railway)

Two services from this repo:

| | Root directory | Start | Env |
|---|---|---|---|
| API | `apps/api` | `npm start` | `ANTHROPIC_API_KEY`, optional `MONGODB_URI`, `CORS_ORIGIN` |
| Web | `apps/web` | `npm start` | `NEXT_PUBLIC_API_URL` |

## Swapping the model

Every model call goes through `callModel` in [apps/api/src/llm.ts](apps/api/src/llm.ts) — the only
file that knows which provider is in use. Changing tiers needs no code change at all:
set `EXTRACTION_MODEL` / `NARRATIVE_MODEL`.
