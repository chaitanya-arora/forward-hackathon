import pdfplumber
from pathlib import Path

with pdfplumber.open(Path(__file__).resolve().parent / "data/raw/quality_holdings.pdf") as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    print(pdf.pages[0].extract_text()[:500])  # preview first page
    
