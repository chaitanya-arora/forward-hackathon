# forward-hackathon

Company PDFs → Agent 1 evidence extraction → Agent 2 ESG assessment → report JSON.

## Start Agent 2

1. Set `GEMINI_API_KEY` in the root `.env` file and save it.
2. From this folder, run:

```powershell
.\run-agent2.ps1
```

3. Open `src/agent2/output/esgReport.json`.

The launcher finds Node automatically, including the installed Codex runtime.
With Node/npm on PATH, `npm run agent2` also works. On a fresh checkout, run
`npm install` first.

For the existing empty Agent 1 sample (no API call):

```powershell
.\run-agent2.ps1 -InputFile src/agent1/output/quality_holdings_resources_2025_classified.json
```

Tests: `.\run-agent2.ps1 -Test` or `npm test`.

## Start Agent 1

From the project root, with Node on PATH:

```powershell
node src/agent1/agent1.js src/agent1/data/raw/quality_holdings.pdf "Quality Holdings Resources" 2025
```

If Node is not on PATH on this machine:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" src/agent1/agent1.js src/agent1/data/raw/quality_holdings.pdf "Quality Holdings Resources" 2025
```

Agent 1 loads the same root `.env` and writes to `src/agent1/output/`.
It calls Gemini and can take time because it processes PDF chunks sequentially.
A successful run with the same company/year replaces that output file.

## Folder map

```text
forward-hackathon/
├── .env                         Private local API key
├── .env.example                 Shareable configuration template
├── README.md                    Start here
├── run-agent2.ps1                Windows launcher
├── package.json                 Shared dependencies and commands
├── package-lock.json
├── src/
│   ├── agent1/
│   │   ├── README.md
│   │   ├── agent1.js            Existing extraction/classification pipeline
│   │   ├── sanitycheck.py       PDF helper
│   │   ├── data/raw/            Original PDFs
│   │   └── output/              Classified evidence JSON
│   └── agent2/
│       ├── README.md            Detailed assessment guide
│       ├── generateESGReport.js
│       ├── normalizeEvidence.js
│       ├── rubric.js
│       ├── examples/            Mock evidence
│       ├── tests/               Offline tests
│       └── output/              Generated ESG report JSON
└── node_modules/                Shared installed dependencies
```

[Agent 1 guide](src/agent1/README.md) · [Agent 2 guide](src/agent2/README.md)

Both agents share the root `.env` and dependencies. Both now default to
`gemini-3.6-flash`; `AGENT1_MODEL` and `AGENT2_MODEL` can override this.
Agent 1's extraction/classification prompt and original data are preserved.
Its paths, model configuration and error handling were repaired during the audit.
Agent 2 scores evidence readiness and adds a simplified AASB S2 readiness section.
There is no Express server or React application yet. Agent 1 saves classifications
through the shared `db.js`; Agent 2 runs independently of SQLite.

## Database and repository hygiene

`esg_reports.db` stays in the project root regardless of the launch directory.
It is private local runtime data and is ignored by Git, along with its journal
files. The existing database is preserved. `ESG_DB_PATH` can select an isolated
database through the process environment for tests.

`node_modules/` is installed locally and no longer tracked. Keep `package.json`
and `package-lock.json`; a fresh clone needs `npm ci` to install the correct
dependencies for its operating system. Windows and macOS native binaries differ.

`saveMemo()` in `db.js` is the teammate's earlier climate-memo interface; it does
not accept Agent 2's broader ESG report schema and is not currently called by
Agent 2. Saving full ESG report JSON is a future integration step.

Verification includes 10 offline tests, a live mock-evidence report, and a live
one-page PDF → Agent 1 → Agent 2 check using an isolated test database. This is a
smoke test, not validation of a full annual report or assessment accuracy.
