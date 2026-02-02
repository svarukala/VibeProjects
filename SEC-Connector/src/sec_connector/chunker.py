"""Document chunking strategies for SEC filings."""

import re
from typing import Optional

from .config import ChunkingConfig
from .models import ContentChunk, DocumentInfo, FilingMetadata, ParsedDocument
from .utils import get_logger

logger = get_logger("chunker")

PAGE_MARKER = "---PAGE---"
MAX_CHUNK_BYTES = 4 * 1024 * 1024  # 4 MB hard limit


def estimate_size_bytes(text: str) -> int:
    """Estimate the byte size of text in UTF-8."""
    return len(text.encode("utf-8"))


def split_by_pages(content: str) -> list[str]:
    """Split content by page markers.

    Args:
        content: Markdown content with ---PAGE--- markers

    Returns:
        List of page contents
    """
    pages = re.split(r"\n*---PAGE---\n*", content)
    return [p.strip() for p in pages if p.strip()]


def split_by_sections(content: str) -> list[str]:
    """Split content by markdown section headers.

    Args:
        content: Markdown content

    Returns:
        List of section contents
    """
    section_pattern = r"(^#{1,3}\s+.+$)"
    parts = re.split(section_pattern, content, flags=re.MULTILINE)

    sections = []
    current = ""

    for part in parts:
        if re.match(r"^#{1,3}\s+", part):
            if current.strip():
                sections.append(current.strip())
            current = part
        else:
            current += part

    if current.strip():
        sections.append(current.strip())

    return sections


def split_by_size(
    content: str,
    target_size: int,
    max_size: int,
    overlap: int = 200,
) -> list[str]:
    """Split content by character size with overlap.

    Args:
        content: Text content
        target_size: Target chunk size in characters
        max_size: Maximum chunk size in characters
        overlap: Overlap between chunks in characters

    Returns:
        List of chunks
    """
    if len(content) <= max_size:
        return [content]

    chunks = []
    paragraphs = re.split(r"\n\n+", content)

    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= target_size:
            current_chunk += ("\n\n" if current_chunk else "") + para
        else:
            if current_chunk:
                chunks.append(current_chunk)

                if overlap > 0 and len(current_chunk) > overlap:
                    overlap_text = current_chunk[-overlap:]
                    last_space = overlap_text.rfind(" ")
                    if last_space > 0:
                        overlap_text = overlap_text[last_space + 1:]
                    current_chunk = overlap_text + "\n\n" + para
                else:
                    current_chunk = para
            else:
                if len(para) <= max_size:
                    chunks.append(para)
                    current_chunk = ""
                else:
                    words = para.split()
                    temp = ""
                    for word in words:
                        if len(temp) + len(word) + 1 <= target_size:
                            temp += (" " if temp else "") + word
                        else:
                            if temp:
                                chunks.append(temp)
                            temp = word
                    if temp:
                        current_chunk = temp

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def enforce_size_limit(content: str, max_bytes: int = MAX_CHUNK_BYTES) -> list[str]:
    """Ensure content doesn't exceed byte size limit.

    Args:
        content: Text content
        max_bytes: Maximum size in bytes

    Returns:
        List of chunks within size limit
    """
    current_size = estimate_size_bytes(content)

    if current_size <= max_bytes:
        return [content]

    target_chars = int(len(content) * (max_bytes * 0.9) / current_size)

    return split_by_size(content, target_chars, target_chars, overlap=0)


def chunk_document(
    parsed_doc: ParsedDocument,
    config: ChunkingConfig,
) -> list[ContentChunk]:
    """Chunk a parsed document into uploadable segments.

    Args:
        parsed_doc: Parsed document
        config: Chunking configuration

    Returns:
        List of ContentChunk objects
    """
    content = parsed_doc.content
    filing = parsed_doc.filing
    document = parsed_doc.document

    chunks = []

    pages = split_by_pages(content)

    if len(pages) <= 1:
        pages = split_by_sections(content)

    if len(pages) <= 1:
        pages = split_by_size(
            content,
            config.target_size,
            config.max_size,
            config.overlap,
        )

    for page_num, page_content in enumerate(pages, start=1):
        sub_chunks = enforce_size_limit(page_content, config.max_item_bytes)

        for sub_idx, sub_content in enumerate(sub_chunks):
            actual_page = page_num if len(sub_chunks) == 1 else f"{page_num}.{sub_idx + 1}"

            chunk_id = f"{filing.cik}-{filing.accession_no_dashes}-{document.sequence}-p{actual_page}"

            title = f"{filing.company_name} - {filing.form} - {filing.filing_date:%Y-%m-%d}"
            if len(pages) > 1:
                title += f" (Page {actual_page})"

            chunk = ContentChunk(
                chunk_id=chunk_id,
                filing=filing,
                document=document,
                page_number=page_num,
                content=sub_content,
                title=title,
            )
            chunks.append(chunk)

    logger.info(
        f"Chunked {document.filename} into {len(chunks)} chunks "
        f"(avg {sum(len(c.content) for c in chunks) // max(len(chunks), 1)} chars)"
    )

    return chunks


def chunk_with_limit(
    parsed_doc: ParsedDocument,
    config: ChunkingConfig,
    max_chunks: Optional[int] = None,
) -> list[ContentChunk]:
    """Chunk a document with optional limit on number of chunks.

    Args:
        parsed_doc: Parsed document
        config: Chunking configuration
        max_chunks: Maximum number of chunks to return

    Returns:
        List of ContentChunk objects (possibly limited)
    """
    chunks = chunk_document(parsed_doc, config)

    if max_chunks and len(chunks) > max_chunks:
        logger.info(f"Limiting chunks from {len(chunks)} to {max_chunks}")
        chunks = chunks[:max_chunks]

    return chunks
