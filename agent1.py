"""
Agent 1: Company Data Extraction — TCFD/AASB S2 Pillar Classification

Pipeline:
  1. Extract text per page from a PDF (keeps page numbers for source citations)
  2. Chunk pages into ~800-1200 token blocks
  3. Classify each chunk against the 4 TCFD pillars (or "not_relevant") via LLM
  4. Aggregate into the agreed JSON schema for Agent 2

Requires:
  pip install pdfplumber google-genai --break-system-packages

Set your API key:
  export GEMINI_API_KEY=your_key_here
  (get one free at https://aistudio.google.com/apikey)
"""

import json
import os
import re
import time

import pdfplumber
from google import genai
from google.genai import types
from dotenv import load_dotenv
load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-2.0-flash"  # fast + cheap + generous free tier, good for high-volume classification

# ---------------------------------------------------------------------------
# 1. PDF -> paged text
# ---------------------------------------------------------------------------

def extract_pages(pdf_path: str) -> list[dict]:
    """Returns [{'page': int, 'text': str}, ...]"""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page": i, "text": text})
    return pages


# ---------------------------------------------------------------------------
# 2. Chunking — group pages into ~1000-token blocks, preserving page ranges
# ---------------------------------------------------------------------------

def chunk_pages(pages: list[dict], target_chars: int = 4000) -> list[dict]:
    """
    Rough chunking by character count (~4000 chars ≈ 1000 tokens).
    Keeps track of which pages contributed to each chunk.
    """
    chunks = []
    buf_text, buf_pages = "", []

    for p in pages:
        buf_text += f"\n\n[Page {p['page']}]\n{p['text']}"
        buf_pages.append(p["page"])
        if len(buf_text) >= target_chars:
            chunks.append({"text": buf_text.strip(), "pages": buf_pages.copy()})
            buf_text, buf_pages = "", []

    if buf_text.strip():
        chunks.append({"text": buf_text.strip(), "pages": buf_pages})

    return chunks


# ---------------------------------------------------------------------------
# 3. Classification prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert classifier for climate-related financial
disclosures under the TCFD framework / AASB S2 Australian standard. You will be
given a chunk of text extracted from a company's annual or sustainability report.

Classify the chunk against these 4 pillars:

1. governance — board/management oversight of climate risks and opportunities:
   who oversees it, how often, board skills/committees, executive remuneration
   links to climate metrics.

2. strategy — material climate-related risks and opportunities, their actual
   or anticipated financial effects, climate scenario analysis, transition
   plans, resilience of the business strategy.

3. risk_management — the PROCESS for identifying, assessing, and managing
   climate risks (not the risks themselves) — how it integrates into the
   entity's overall risk management framework.

4. metrics_targets — quantitative data: Scope 1/2/3 GHG emissions, financed
   emissions (for financial institutions), other climate metrics, targets and
   progress against them.

If the chunk does not meaningfully relate to any pillar (e.g. it's a cover
page, table of contents, unrelated financial statements, generic company
history), classify it as "not_relevant".

A chunk can touch on more than one pillar — return the SINGLE most dominant
pillar. Do not force a classification if the content is genuinely generic.

Respond with ONLY valid JSON, no other text, in this exact shape:
{
  "pillar": "governance" | "strategy" | "risk_management" | "metrics_targets" | "not_relevant",
  "confidence": <float 0.0-1.0>,
  "justification": "<one sentence explaining why>"
}
"""

# Gemini uses "user" / "model" roles (not "assistant") for chat history
FEW_SHOT_EXAMPLES = [
    {
        "role": "user",
        "parts": [{"text": "The Board's Sustainability Committee meets four times a year "
                            "and reviews management's recommendations on climate-related "
                            "risks and opportunities. Executive remuneration includes a "
                            "15% climate metrics component in the annual scorecard."}],
    },
    {
        "role": "model",
        "parts": [{"text": json.dumps({
            "pillar": "governance",
            "confidence": 0.95,
            "justification": "Describes board committee oversight structure and "
                              "executive remuneration links to climate metrics.",
        })}],
    },
    {
        "role": "user",
        "parts": [{"text": "Net equity Scope 1 and 2 GHG emissions were 4.2 MtCO2e in "
                            "2025, a reduction of 8% against the 2020 baseline. The "
                            "company remains on track to meet its 2030 target of a 30% "
                            "reduction."}],
    },
    {
        "role": "model",
        "parts": [{"text": json.dumps({
            "pillar": "metrics_targets",
            "confidence": 0.98,
            "justification": "Reports specific emissions figures and progress "
                              "against a quantitative reduction target.",
        })}],
    },
]


def classify_chunk(chunk_text: str, retries: int = 3) -> dict:
    contents = FEW_SHOT_EXAMPLES + [
        {"role": "user", "parts": [{"text": chunk_text}]}
    ]

    for attempt in range(retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",  # forces valid JSON output
                    max_output_tokens=300,
                    temperature=0.1,  # low temp — this is a classification task, not creative writing
                ),
            )
            raw = response.text.strip()
            return json.loads(raw)

        except json.JSONDecodeError:
            return {"pillar": "not_relevant", "confidence": 0.0,
                    "justification": f"Failed to parse model output: {raw[:200]}"}
        except Exception as e:
            # Free-tier rate limits are common — back off and retry
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    (retrying after error: {e}, waiting {wait}s)")
                time.sleep(wait)
            else:
                return {"pillar": "not_relevant", "confidence": 0.0,
                        "justification": f"API call failed after {retries} attempts: {e}"}


# ---------------------------------------------------------------------------
# 4. Aggregate into the Agent 1 -> Agent 2 schema
# ---------------------------------------------------------------------------

def build_output_schema(company_name: str, report_year: str,
                         chunks: list[dict], classifications: list[dict]) -> dict:
    pillars = {
        "governance": {"raw_text_chunks": [], "source_pages": []},
        "strategy": {"raw_text_chunks": [], "source_pages": []},
        "risk_management": {"raw_text_chunks": [], "source_pages": []},
        "metrics_targets": {"raw_text_chunks": [], "source_pages": []},
    }

    for chunk, result in zip(chunks, classifications):
        pillar = result.get("pillar")
        if pillar in pillars and result.get("confidence", 0) >= 0.5:
            pillars[pillar]["raw_text_chunks"].append({
                "text": chunk["text"],
                "confidence": result["confidence"],
                "justification": result["justification"],
            })
            pillars[pillar]["source_pages"].extend(chunk["pages"])

    # de-dupe + sort source pages
    for p in pillars.values():
        p["source_pages"] = sorted(set(p["source_pages"]))

    return {
        "company_name": company_name,
        "report_year": report_year,
        "pillars": pillars,
    }


# ---------------------------------------------------------------------------
# 5. Run end-to-end
# ---------------------------------------------------------------------------

def run(pdf_path: str, company_name: str, report_year: str, out_path: str):
    print(f"Extracting pages from {pdf_path}...")
    pages = extract_pages(pdf_path)
    print(f"  {len(pages)} pages with text")

    chunks = chunk_pages(pages)
    print(f"Classifying {len(chunks)} chunks...")

    classifications = []
    for i, c in enumerate(chunks, start=1):
        result = classify_chunk(c["text"])
        classifications.append(result)
        print(f"  [{i}/{len(chunks)}] pages {c['pages'][0]}-{c['pages'][-1]} "
              f"-> {result['pillar']} ({result['confidence']:.2f})")

    output = build_output_schema(company_name, report_year, chunks, classifications)

    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone. Wrote structured output to {out_path}")
    for pillar, data in output["pillars"].items():
        print(f"  {pillar}: {len(data['raw_text_chunks'])} chunks, "
              f"pages {data['source_pages']}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print("Usage: python classify_tcfd.py <pdf_path> <company_name> <report_year>")
        sys.exit(1)

    pdf_path, company_name, report_year = sys.argv[1], sys.argv[2], sys.argv[3]
    out_path = f"{company_name.lower().replace(' ', '_')}_{report_year}_classified.json"
    run(pdf_path, company_name, report_year, out_path)