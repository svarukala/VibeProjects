"""Document parser for SEC EDGAR filings - SGML/HTML to Markdown conversion."""

import re
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup, NavigableString, Tag
from markdownify import MarkdownConverter

from .models import DocumentInfo, FilingMetadata, ParsedDocument
from .utils import get_logger

logger = get_logger("parser")


def _parse_dimension_inches(el) -> tuple[Optional[float], Optional[float]]:
    """Extract width and height from an element's style or attributes, in inches.

    Handles both inline CSS (style="width:0.14in;height:0.90in") and
    HTML attributes (width="10" height="65"), converting px to inches
    at 96 dpi.
    """
    style = el.get("style", "")

    # Try inline CSS first (inches)
    w_match = re.search(r"width:\s*([\d.]+)in", style)
    h_match = re.search(r"height:\s*([\d.]+)in", style)
    if w_match and h_match:
        return float(w_match.group(1)), float(h_match.group(1))

    # Try inline CSS (px) — convert at 96 dpi
    w_match = re.search(r"width:\s*([\d.]+)px", style)
    h_match = re.search(r"height:\s*([\d.]+)px", style)
    if w_match and h_match:
        return float(w_match.group(1)) / 96, float(h_match.group(1)) / 96

    # Try HTML attributes (assumed px at 96 dpi)
    w_attr = el.get("width")
    h_attr = el.get("height")
    if w_attr and h_attr:
        try:
            return float(w_attr) / 96, float(h_attr) / 96
        except ValueError:
            pass

    return None, None


def _is_rotated_text_image(el) -> bool:
    """Detect images that are likely rotated text (narrow width, taller height).

    SEC filings often render vertically-oriented table headers as small images
    with width << height. These typically have width ~0.13-0.15in and height
    varying by name length.
    """
    w, h = _parse_dimension_inches(el)
    if w is not None and h is not None:
        return w < 0.3 and h > w * 2
    return False


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

    def convert_img(self, el, text=None, *args, **kwargs):
        """Handle <img> tags in SEC filings.

        - Rotated text images (narrow width, tall): replace with [image: rotated text]
          marker so downstream processing can identify these gaps.
        - Generic alt="LOGO" images: strip entirely (decorative logos, icons, etc.)
        - Images with meaningful alt text: preserve as [alt text].
        """
        alt = (el.get("alt") or "").strip()

        if _is_rotated_text_image(el):
            # Mark as rotated text so it's clear something is missing
            return "[rotated text]"

        if alt.upper() == "LOGO" or not alt:
            # Decorative image — strip it
            return ""

        # Meaningful alt text — keep it
        return f"[{alt}]"

    def convert_br(self, el, text=None, *args, **kwargs):
        """Convert <br> to newline."""
        return "\n"

    def convert_hr(self, el, text=None, *args, **kwargs):
        """Convert <hr> to markdown horizontal rule."""
        return "\n---\n"


def _ocr_image(image, ocr_engine: str, easyocr_reader=None):
    """Run OCR on a PIL Image and return extracted text.

    Args:
        image: PIL Image (already rotated/scaled as needed)
        ocr_engine: "easyocr" or "pytesseract"
        easyocr_reader: Initialized easyocr.Reader (required if engine is easyocr)

    Returns:
        Extracted text string, or empty string on failure.
    """
    import numpy as np

    img_array = np.array(image)

    if ocr_engine == "easyocr":
        results = easyocr_reader.readtext(img_array, detail=0)
        return " ".join(results).strip()
    else:
        import pytesseract
        return pytesseract.image_to_string(image, config="--psm 7").strip()


def _clean_ocr_text(text: str) -> str:
    """Clean common OCR artifacts from short text strings (names, labels).

    Typical artifacts on tiny SEC images:
    - Punctuation misreads: "A:" -> "A.", "S_" -> "S."
    - Stray digits near punctuation: "S_ 3 Demchak" -> "S. Demchak"
    - Leading/trailing noise characters
    """
    # Fix misread periods (colon/underscore followed by optional stray digits before a capital)
    text = re.sub(r"(\w)[_:]\s*\d*\s+(?=[A-Z])", r"\1. ", text)
    # Strip leading/trailing non-alpha noise (but keep periods in names)
    text = re.sub(r"^[^A-Za-z]+", "", text)
    text = re.sub(r"[^A-Za-z.]+$", "", text)
    return text.strip()


def resolve_rotated_text_images(
    soup: BeautifulSoup,
    base_url: str,
    user_agent: str = "SEC-Connector/1.0 (sec-connector@example.com)",
) -> int:
    """Download and OCR rotated-text images, replacing them with extracted text in the DOM.

    SEC filings commonly render vertically-oriented table column headers as small
    JPG images (e.g., director names rotated 90°). This function detects those
    images, downloads them from SEC, rotates and upscales them, then OCRs the text.

    Requires: Pillow + (easyocr or pytesseract with Tesseract installed).
    If dependencies are missing, returns 0 (graceful degradation).

    Args:
        soup: Parsed BeautifulSoup DOM (modified in place)
        base_url: Base URL for resolving relative image src paths
        user_agent: User-Agent header for SEC requests

    Returns:
        Number of images successfully resolved.
    """
    try:
        from io import BytesIO
        from PIL import Image
        import requests as sync_requests
    except ImportError:
        logger.debug("Pillow not available — skipping rotated text image resolution")
        return 0

    # Try to import an OCR engine (easyocr preferred, pytesseract as fallback)
    ocr_engine = None
    easyocr_reader = None
    try:
        import easyocr
        easyocr_reader = easyocr.Reader(["en"], verbose=False)
        ocr_engine = "easyocr"
    except ImportError:
        try:
            import pytesseract  # noqa: F401
            ocr_engine = "pytesseract"
        except ImportError:
            logger.debug("No OCR engine available (install easyocr or pytesseract)")
            return 0

    # Collect rotated-text images before iterating (avoid mutating during traversal)
    rotated_imgs = [
        img for img in soup.find_all("img")
        if _is_rotated_text_image(img) and img.get("src")
    ]

    if not rotated_imgs:
        return 0

    logger.info(f"Found {len(rotated_imgs)} rotated-text images, resolving with {ocr_engine}")

    resolved = 0
    session = sync_requests.Session()
    session.headers["User-Agent"] = user_agent

    for img_tag in rotated_imgs:
        src = img_tag["src"]

        # Build absolute URL
        img_url = src if src.startswith("http") else base_url.rstrip("/") + "/" + src

        try:
            resp = session.get(img_url, timeout=10)
            resp.raise_for_status()

            image = Image.open(BytesIO(resp.content))

            # Rotate 90° clockwise (text is rendered bottom-to-top)
            rotated = image.rotate(-90, expand=True)

            # Upscale tiny images for better OCR accuracy
            w, h = rotated.size
            if h < 100:
                scale = max(3, 100 // h)
                rotated = rotated.resize((w * scale, h * scale), Image.LANCZOS)

            text = _ocr_image(rotated, ocr_engine, easyocr_reader)

            if text and len(text) > 1:
                text = _clean_ocr_text(text)
                img_tag.replace_with(text)
                logger.info(f"OCR resolved: {src} -> '{text}'")
                resolved += 1
            else:
                logger.debug(f"OCR returned empty for {src}")
        except Exception as e:
            logger.debug(f"Failed to OCR {src}: {e}")

    session.close()
    return resolved


def html_to_markdown(html: str, base_url: Optional[str] = None) -> str:
    """Convert HTML content to Markdown.

    Args:
        html: HTML content string
        base_url: Optional base URL for resolving image sources for OCR.
                  If provided and OCR dependencies are installed, rotated-text
                  images will be resolved to actual text.

    Returns:
        Markdown formatted string
    """
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(["script", "style", "meta", "link"]):
        tag.decompose()

    # Resolve rotated text images via OCR before stripping styles
    if base_url:
        resolve_rotated_text_images(soup, base_url)

    for tag in soup.find_all(True):
        if tag.get("style") and tag.name != "img":
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


def _build_filing_base_url(filing: FilingMetadata) -> str:
    """Build the SEC base URL for a filing's directory (used to resolve image src paths).

    Example: https://www.sec.gov/Archives/edgar/data/713676/000119312525052937/
    """
    accession_no_dashes = filing.accession_number.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{filing.cik}/{accession_no_dashes}/"


def parse_document(
    file_path: Path,
    filing: FilingMetadata,
    document: DocumentInfo,
    ocr_images: bool = False,
) -> Optional[ParsedDocument]:
    """Parse a downloaded document file.

    Args:
        file_path: Path to downloaded file
        filing: Filing metadata
        document: Document info
        ocr_images: If True, download and OCR rotated-text images to recover
                    text (e.g., vertical column headers rendered as images).
                    Requires easyocr or pytesseract.

    Returns:
        ParsedDocument or None if parsing fails
    """
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.error(f"Failed to read {file_path}: {e}")
        return None

    base_url = _build_filing_base_url(filing) if ocr_images else None

    if file_path.suffix.lower() in [".htm", ".html"]:
        content = clean_sec_text(content)
        markdown = html_to_markdown(content, base_url=base_url)
    elif file_path.suffix.lower() == ".txt":
        if "<html" in content.lower() or "<body" in content.lower():
            content = clean_sec_text(content)
            markdown = html_to_markdown(content, base_url=base_url)
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
