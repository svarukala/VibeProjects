"""Document parser for SEC EDGAR filings - SGML/HTML to Markdown conversion."""

import re
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup, NavigableString, Tag
from markdownify import MarkdownConverter

from .models import DocumentInfo, FilingMetadata, ParsedDocument
from .utils import get_logger

logger = get_logger("parser")


class SECMarkdownConverter(MarkdownConverter):
    """Custom markdown converter for SEC filings."""

    def convert_table(self, el, text=None, *args, **kwargs):
        """Convert tables to markdown format."""
        rows = el.find_all("tr")
        if not rows:
            return text or ""

        md_rows = []
        header_processed = False

        for row in rows:
            cells = row.find_all(["th", "td"])
            if not cells:
                continue

            cell_texts = []
            for cell in cells:
                cell_text = self.convert(str(cell)).strip()
                cell_text = cell_text.replace("|", "\\|")
                cell_text = " ".join(cell_text.split())
                cell_texts.append(cell_text)

            md_rows.append("| " + " | ".join(cell_texts) + " |")

            if not header_processed and (row.find("th") or len(md_rows) == 1):
                separator = "| " + " | ".join(["---"] * len(cells)) + " |"
                md_rows.append(separator)
                header_processed = True

        if not header_processed and md_rows:
            first_row = md_rows[0]
            num_cols = first_row.count("|") - 1
            separator = "| " + " | ".join(["---"] * num_cols) + " |"
            md_rows.insert(1, separator)

        return "\n" + "\n".join(md_rows) + "\n\n"

    def convert_br(self, el, text=None, *args, **kwargs):
        """Convert <br> to newline."""
        return "\n"

    def convert_hr(self, el, text=None, *args, **kwargs):
        """Convert <hr> to markdown horizontal rule."""
        return "\n---\n"


def html_to_markdown(html: str) -> str:
    """Convert HTML content to Markdown.

    Args:
        html: HTML content string

    Returns:
        Markdown formatted string
    """
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(["script", "style", "meta", "link"]):
        tag.decompose()

    for tag in soup.find_all(True):
        if tag.get("style"):
            del tag["style"]
        if tag.get("class"):
            del tag["class"]

    try:
        converter = SECMarkdownConverter(
            heading_style="atx",
            bullets="-",
            strip=["a"],
        )

        markdown = converter.convert(str(soup))
    except RecursionError:
        # Fall back to plain text extraction for deeply nested HTML
        logger.warning("HTML too deeply nested, falling back to text extraction")
        markdown = soup.get_text(separator="\n")

    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    markdown = re.sub(r"[ \t]+\n", "\n", markdown)
    markdown = re.sub(r"\n[ \t]+", "\n", markdown)

    lines = markdown.split("\n")
    cleaned_lines = [line.rstrip() for line in lines]
    markdown = "\n".join(cleaned_lines)

    return markdown.strip()


def extract_sgml_documents(content: str) -> list[dict]:
    """Extract individual documents from SGML wrapper.

    Args:
        content: Raw SGML filing content

    Returns:
        List of document dicts with 'type', 'sequence', 'filename', 'text'
    """
    documents = []

    doc_pattern = re.compile(
        r"<DOCUMENT>(.*?)</DOCUMENT>",
        re.DOTALL | re.IGNORECASE
    )

    for match in doc_pattern.finditer(content):
        doc_content = match.group(1)

        doc_type = ""
        sequence = ""
        filename = ""

        type_match = re.search(r"<TYPE>([^\n<]+)", doc_content, re.IGNORECASE)
        if type_match:
            doc_type = type_match.group(1).strip()

        seq_match = re.search(r"<SEQUENCE>([^\n<]+)", doc_content, re.IGNORECASE)
        if seq_match:
            sequence = seq_match.group(1).strip()

        fn_match = re.search(r"<FILENAME>([^\n<]+)", doc_content, re.IGNORECASE)
        if fn_match:
            filename = fn_match.group(1).strip()

        text_match = re.search(r"<TEXT>(.*?)(</TEXT>|$)", doc_content, re.DOTALL | re.IGNORECASE)
        text = text_match.group(1).strip() if text_match else doc_content

        documents.append({
            "type": doc_type,
            "sequence": sequence,
            "filename": filename,
            "text": text,
        })

    return documents


def clean_sec_text(text: str) -> str:
    """Clean SEC-specific text artifacts.

    Args:
        text: Raw text from SEC filing

    Returns:
        Cleaned text
    """
    text = re.sub(r"&nbsp;", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"&#160;", " ", text)
    text = re.sub(r"&amp;", "&", text, flags=re.IGNORECASE)
    text = re.sub(r"&lt;", "<", text, flags=re.IGNORECASE)
    text = re.sub(r"&gt;", ">", text, flags=re.IGNORECASE)
    text = re.sub(r"&quot;", '"', text, flags=re.IGNORECASE)

    text = re.sub(r"<PAGE>\s*", "\n\n---PAGE---\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"-----+\s*PAGE\s*-----+", "\n\n---PAGE---\n\n", text, flags=re.IGNORECASE)

    text = re.sub(r"<[A-Z]+>(?=\s*\n)", "", text)

    return text


def parse_document(
    file_path: Path,
    filing: FilingMetadata,
    document: DocumentInfo,
) -> Optional[ParsedDocument]:
    """Parse a downloaded document file.

    Args:
        file_path: Path to downloaded file
        filing: Filing metadata
        document: Document info

    Returns:
        ParsedDocument or None if parsing fails
    """
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.error(f"Failed to read {file_path}: {e}")
        return None

    if file_path.suffix.lower() in [".htm", ".html"]:
        content = clean_sec_text(content)
        markdown = html_to_markdown(content)
    elif file_path.suffix.lower() == ".txt":
        if "<html" in content.lower() or "<body" in content.lower():
            content = clean_sec_text(content)
            markdown = html_to_markdown(content)
        else:
            content = clean_sec_text(content)
            markdown = content
    else:
        markdown = content

    markdown = re.sub(r"\n{4,}", "\n\n\n", markdown)

    if len(markdown.strip()) < 100:
        logger.warning(f"Document too short after parsing: {file_path}")
        return None

    return ParsedDocument(
        filing=filing,
        document=document,
        content=markdown,
        content_type="text/markdown",
    )


def parse_filing_index(content: str) -> dict:
    """Parse a filing index file to extract document list.

    Args:
        content: Index file content

    Returns:
        Dict with 'documents' list
    """
    documents = []

    lines = content.split("\n")
    in_document_section = False

    for line in lines:
        if "DOCUMENT" in line.upper() and "SEQUENCE" in line.upper():
            in_document_section = True
            continue

        if in_document_section and line.strip():
            parts = line.split()
            if len(parts) >= 3:
                documents.append({
                    "sequence": parts[0],
                    "filename": parts[1] if len(parts) > 1 else "",
                    "type": parts[2] if len(parts) > 2 else "",
                    "description": " ".join(parts[3:]) if len(parts) > 3 else "",
                })

    return {"documents": documents}
