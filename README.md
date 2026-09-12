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

Both agents share the root `.env` and dependencies. Agent 1's extraction and
classification logic is preserved; only paths, environment loading and output
location were adjusted. Original PDFs and the classified sample are preserved.
Agent 2 scores evidence readiness and adds a simplified AASB S2 readiness section.
There is no Express server, React application or mandatory database yet.
