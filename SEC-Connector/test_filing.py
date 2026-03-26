"""
Standalone script to download, parse, chunk, and inspect a single SEC filing
exactly like the connector pipeline does.

Usage:
    python test_filing.py <URL> [--output-dir OUTPUT_DIR] [--ocr]

Example:
    python test_filing.py https://www.sec.gov/Archives/edgar/data/713676/000119312525052937/d889589ddef14a.htm
    python test_filing.py https://www.sec.gov/Archives/edgar/data/713676/000119312525052937/d889589ddef14a.htm --ocr
    python test_filing.py https://www.sec.gov/Archives/edgar/data/713676/000119312525052937/d889589ddef14a.htm --output-dir my_output
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import requests

# Add src to path so we can import the connector modules
sys.path.insert(0, str(Path(__file__).parent / "src"))

from sec_connector.chunker import chunk_document
from sec_connector.config import ChunkingConfig
from sec_connector.models import ContentChunk, DocumentInfo, FilingMetadata, ParsedDocument
from sec_connector.parser import clean_sec_text, html_to_markdown


def parse_sec_url(url: str) -> dict:
    """Extract CIK, accession number, and filename from a SEC EDGAR URL."""
    # Pattern: /Archives/edgar/data/{cik}/{accession}/{filename}
    match = re.search(
        r"/Archives/edgar/data/(\d+)/(\d+)/(.+)$",
        urlparse(url).path,
    )
    if not match:
        raise ValueError(f"Could not parse SEC URL: {url}")

    cik = match.group(1)
    accession_no_dashes = match.group(2)
    filename = match.group(3)

    # Reconstruct accession with dashes: 0001193125-25-052937
    if len(accession_no_dashes) == 18:
        accession = f"{accession_no_dashes[:10]}-{accession_no_dashes[10:12]}-{accession_no_dashes[12:]}"
    else:
        accession = accession_no_dashes

    return {
        "cik": cik,
        "accession_number": accession,
        "accession_no_dashes": accession_no_dashes,
        "filename": filename,
    }


def download_filing(url: str) -> str:
    """Download the filing content from SEC."""
    headers = {"User-Agent": "SEC-Connector/1.0 (test@example.com)"}
    print(f"Downloading: {url}")
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    print(f"  Downloaded {len(resp.text):,} characters")
    return resp.text


def fetch_filing_metadata(cik: str, accession_no_dashes: str) -> dict:
    """Fetch filing metadata from the SEC index to get company name, form type, date."""
    index_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/index.json"
    headers = {"User-Agent": "SEC-Connector/1.0 (test@example.com)"}
    print(f"Fetching index: {index_url}")
    try:
        resp = requests.get(index_url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        directory = data.get("directory", {})
        parent = directory.get("parent-dir", "")
        items = directory.get("item", [])

        # Try to get form type and date from the filing index page
        filing_index_url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=&dateb=&owner=include&count=1&search_text=&action=getcompany"

        # Parse from the submissions API instead
        submissions_url = f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"
        resp2 = requests.get(submissions_url, headers=headers, timeout=30)
        resp2.raise_for_status()
        sub_data = resp2.json()

        company_name = sub_data.get("name", "Unknown Company")
        tickers = sub_data.get("tickers", [])
        ticker = tickers[0] if tickers else "UNKNOWN"

        # Find matching filing in recent filings
        recent = sub_data.get("filings", {}).get("recent", {})
        accession_numbers = recent.get("accessionNumber", [])
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])

        accession_with_dashes = f"{accession_no_dashes[:10]}-{accession_no_dashes[10:12]}-{accession_no_dashes[12:]}"
        form_type = "UNKNOWN"
        filing_date = datetime.now()

        for i, acc in enumerate(accession_numbers):
            if acc == accession_with_dashes:
                form_type = forms[i] if i < len(forms) else "UNKNOWN"
                filing_date = datetime.strptime(dates[i], "%Y-%m-%d") if i < len(dates) else datetime.now()
                break

        return {
            "company_name": company_name,
            "ticker": ticker,
            "form": form_type,
            "filing_date": filing_date,
        }
    except Exception as e:
        print(f"  Warning: Could not fetch metadata ({e}), using defaults")
        return {
            "company_name": "Unknown Company",
            "ticker": "UNKNOWN",
            "form": "UNKNOWN",
            "filing_date": datetime.now(),
        }


def build_payload(chunk: ContentChunk) -> dict:
    """Build the Graph API payload dict for a chunk (same as graph_client.build_payload)."""
    filing = chunk.filing

    properties = {
        "Title": chunk.title,
        "Company": filing.company_name,
        "Ticker": filing.ticker,
        "Form": filing.form,
        "FilingDate": filing.filing_date.isoformat(),
        "Description": f"{filing.form} filing for {filing.company_name}",
        "Url": filing.sec_url,
        "CIK": filing.cik,
        "AccessionNumber": filing.accession_number,
        "Sequence": chunk.document.sequence,
        "Page": chunk.page_number,
    }

    content = {
        "type": "text",
        "value": chunk.content,
    }

    return {
        "id": chunk.graph_item_id,
        "properties": properties,
        "content": content,
        "acl": [{"type": "everyone", "value": "everyone", "accessType": "grant"}],
    }


def main():
    parser = argparse.ArgumentParser(description="Test SEC filing processing pipeline")
    parser.add_argument("url", help="SEC EDGAR filing URL")
    parser.add_argument(
        "--output-dir",
        default="data/test_output",
        help="Output directory (default: data/test_output)",
    )
    parser.add_argument(
        "--ocr",
        action="store_true",
        help="Enable OCR for rotated-text images (requires Pillow + pytesseract + Tesseract)",
    )
    args = parser.parse_args()

    url = args.url
    output_dir = Path(args.output_dir)

    # 1. Parse the URL
    url_parts = parse_sec_url(url)
    print(f"\nParsed URL:")
    print(f"  CIK:       {url_parts['cik']}")
    print(f"  Accession: {url_parts['accession_number']}")
    print(f"  Filename:  {url_parts['filename']}")

    # 2. Fetch metadata from SEC API
    meta = fetch_filing_metadata(url_parts["cik"], url_parts["accession_no_dashes"])
    print(f"\nFiling metadata:")
    print(f"  Company: {meta['company_name']}")
    print(f"  Ticker:  {meta['ticker']}")
    print(f"  Form:    {meta['form']}")
    print(f"  Date:    {meta['filing_date']:%Y-%m-%d}")

    # 3. Download the filing
    raw_content = download_filing(url)

    # 4. Build model objects (same as pipeline does)
    filing = FilingMetadata(
        cik=url_parts["cik"],
        accession_number=url_parts["accession_number"],
        form=meta["form"],
        filing_date=meta["filing_date"],
        company_name=meta["company_name"],
        ticker=meta["ticker"],
        primary_document=url_parts["filename"],
    )

    document = DocumentInfo(
        sequence=1,
        filename=url_parts["filename"],
        document_type=meta["form"],
        description=f"{meta['form']} filing",
    )

    # 5. Parse: clean SEC text + convert HTML to Markdown (exact same as parser.py)
    print("\nParsing...")
    cleaned = clean_sec_text(raw_content)

    # Build base URL for image resolution (directory containing the filing)
    base_url = None
    if args.ocr:
        parsed_url = urlparse(url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}{'/'.join(parsed_url.path.split('/')[:-1])}/"
        print(f"  OCR enabled, base URL: {base_url}")

    markdown = html_to_markdown(cleaned, base_url=base_url)
    markdown = re.sub(r"\n{4,}", "\n\n\n", markdown)

    if len(markdown.strip()) < 100:
        print("ERROR: Document too short after parsing (<100 chars)")
        sys.exit(1)

    parsed_doc = ParsedDocument(
        filing=filing,
        document=document,
        content=markdown,
        content_type="text/markdown",
    )
    print(f"  Markdown length: {len(markdown):,} characters")

    # 6. Chunk (exact same as chunker.py with default config)
    config = ChunkingConfig()
    chunks = chunk_document(parsed_doc, config)
    print(f"\nChunking:")
    print(f"  Strategy config: target={config.target_size}, max={config.max_size}, overlap={config.overlap}")
    print(f"  Chunks created: {len(chunks)}")

    chunk_sizes = [len(c.content) for c in chunks]
    if chunk_sizes:
        print(f"  Avg chunk size:  {sum(chunk_sizes) // len(chunk_sizes):,} chars")
        print(f"  Min chunk size:  {min(chunk_sizes):,} chars")
        print(f"  Max chunk size:  {max(chunk_sizes):,} chars")

    # 7. Write outputs
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save raw HTML
    raw_file = output_dir / "01_raw.html"
    raw_file.write_text(raw_content, encoding="utf-8")
    print(f"\nSaved: {raw_file}")

    # Save full markdown
    md_file = output_dir / "02_full_markdown.md"
    md_file.write_text(markdown, encoding="utf-8")
    print(f"Saved: {md_file}")

    # Save each chunk as markdown
    chunks_dir = output_dir / "chunks_md"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    for chunk in chunks:
        chunk_file = chunks_dir / f"{chunk.chunk_id}.md"
        header = (
            f"<!-- chunk_id: {chunk.chunk_id} -->\n"
            f"<!-- title: {chunk.title} -->\n"
            f"<!-- page: {chunk.page_number} -->\n"
            f"<!-- chars: {len(chunk.content)} -->\n\n"
        )
        chunk_file.write_text(header + chunk.content, encoding="utf-8")

    print(f"Saved: {len(chunks)} chunk .md files in {chunks_dir}/")

    # Save each chunk as JSON payload (exactly what would be uploaded to Graph)
    payloads_dir = output_dir / "chunks_json"
    payloads_dir.mkdir(parents=True, exist_ok=True)
    for chunk in chunks:
        payload = build_payload(chunk)
        payload_file = payloads_dir / f"{chunk.chunk_id}.json"
        payload_file.write_text(
            json.dumps(payload, indent=2, default=str), encoding="utf-8"
        )

    print(f"Saved: {len(chunks)} chunk .json payloads in {payloads_dir}/")

    # Save a summary
    summary = {
        "url": url,
        "cik": filing.cik,
        "accession_number": filing.accession_number,
        "company": filing.company_name,
        "ticker": filing.ticker,
        "form": filing.form,
        "filing_date": filing.filing_date.isoformat(),
        "raw_html_chars": len(raw_content),
        "markdown_chars": len(markdown),
        "num_chunks": len(chunks),
        "chunk_sizes": {c.chunk_id: len(c.content) for c in chunks},
        "chunking_config": {
            "target_size": config.target_size,
            "max_size": config.max_size,
            "overlap": config.overlap,
            "max_item_bytes": config.max_item_bytes,
        },
    }
    summary_file = output_dir / "00_summary.json"
    summary_file.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(f"Saved: {summary_file}")

    print(f"\nDone! All output in: {output_dir}/")


if __name__ == "__main__":
    main()
