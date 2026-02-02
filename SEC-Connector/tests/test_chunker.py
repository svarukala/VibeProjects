"""Tests for document chunking."""

from datetime import datetime

import pytest

from sec_connector.chunker import (
    chunk_document,
    enforce_size_limit,
    split_by_pages,
    split_by_sections,
    split_by_size,
)
from sec_connector.config import ChunkingConfig
from sec_connector.models import DocumentInfo, FilingMetadata, ParsedDocument


@pytest.fixture
def sample_filing():
    """Create a sample filing for testing."""
    return FilingMetadata(
        cik="0000320193",
        accession_number="0000320193-23-000077",
        form="10-K",
        filing_date=datetime(2023, 11, 3),
        company_name="Apple Inc.",
        ticker="AAPL",
    )


@pytest.fixture
def sample_document():
    """Create a sample document for testing."""
    return DocumentInfo(
        sequence=1,
        filename="test.htm",
        document_type="10-K",
    )


@pytest.fixture
def chunking_config():
    """Create chunking config for testing."""
    return ChunkingConfig(
        target_size=1000,
        max_size=2000,
        overlap=100,
    )


def test_split_by_pages():
    """Test page-based splitting."""
    content = "Page 1 content\n\n---PAGE---\n\nPage 2 content\n\n---PAGE---\n\nPage 3 content"
    pages = split_by_pages(content)

    assert len(pages) == 3
    assert pages[0] == "Page 1 content"
    assert pages[1] == "Page 2 content"
    assert pages[2] == "Page 3 content"


def test_split_by_sections():
    """Test section header splitting."""
    content = "# Section 1\n\nContent 1\n\n## Section 2\n\nContent 2\n\n### Section 3\n\nContent 3"
    sections = split_by_sections(content)

    assert len(sections) == 3
    assert "Section 1" in sections[0]
    assert "Section 2" in sections[1]
    assert "Section 3" in sections[2]


def test_split_by_size():
    """Test size-based splitting."""
    content = "Word " * 500  # ~2500 chars
    chunks = split_by_size(content, target_size=500, max_size=1000, overlap=50)

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 1000


def test_enforce_size_limit_small_content():
    """Test that small content is not split."""
    content = "Small content"
    result = enforce_size_limit(content, max_bytes=1000)

    assert len(result) == 1
    assert result[0] == content


def test_chunk_document(sample_filing, sample_document, chunking_config):
    """Test full document chunking."""
    content = "Page 1\n\n---PAGE---\n\nPage 2\n\n---PAGE---\n\nPage 3"

    parsed = ParsedDocument(
        filing=sample_filing,
        document=sample_document,
        content=content,
    )

    chunks = chunk_document(parsed, chunking_config)

    assert len(chunks) == 3
    assert all(c.filing == sample_filing for c in chunks)
    assert all(c.document == sample_document for c in chunks)


def test_chunk_document_no_markers(sample_filing, sample_document, chunking_config):
    """Test chunking without page markers falls back to size-based."""
    content = "Word " * 1000  # Long content without markers

    parsed = ParsedDocument(
        filing=sample_filing,
        document=sample_document,
        content=content,
    )

    chunks = chunk_document(parsed, chunking_config)

    assert len(chunks) > 1
