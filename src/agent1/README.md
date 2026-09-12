# Agent 1: evidence extraction

This folder contains the existing teammate's PDF extraction and climate pillar
classification pipeline. Reorganization preserved that logic and the original
PDFs/sample JSON. Only path handling changed to support the new location.

## Files

- `agent1.js`: PDF text extraction, chunking, Gemini classification and JSON output.
- `sanitycheck.py`: extracts a first-page preview from the included PDF.
- `data/raw/`: original input PDFs.
- `output/`: classified evidence for Agent 2, including the existing empty sample.

## Run from the project root

Set `GEMINI_API_KEY` in the project's root `.env`, then run:

```powershell
node src/agent1/agent1.js src/agent1/data/raw/quality_holdings.pdf "Quality Holdings Resources" 2025
```

Or use `npm run agent1 -- <pdf_path> "<company_name>" <report_year>`.
See the root README for the full Node executable command if Node is not on PATH.

Explicit relative PDF paths are relative to your terminal's current directory.
The `.env` path and output directory are resolved relative to the script.
Output is written to `src/agent1/output/<company>_<year>_classified.json`.
Running again with the same company/year replaces that file.

The model remains the existing `gemini-2.0-flash`; this reorganization does not
change its configuration or verify its live availability. API calls require a
working key and model access.

## Connect to Agent 2

```powershell
.\run-agent2.ps1 -InputFile src/agent1/output/quality_holdings_resources_2025_classified.json
```

Agent 2 writes the report to `src/agent2/output/esgReport.json`. The checked-in
Agent 1 sample is empty, so it currently produces all-missing assessments.

## Python helper

In a Python environment with `pdfplumber` installed:

```powershell
python src/agent1/sanitycheck.py
```

Its PDF path is relative to this helper file, so it works from any directory.
Python dependencies remain separate from the Node dependencies.
