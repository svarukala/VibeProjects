"""SEC EDGAR API client for fetching filing metadata and documents."""

import asyncio
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiohttp

from .config import AppConfig
from .models import DocumentInfo, FilingMetadata
from .utils import RateLimiter, get_logger, retry_with_backoff

logger = get_logger("sec_client")


class SECClient:
    """Client for interacting with SEC EDGAR API."""

    def __init__(self, config: AppConfig):
        self.config = config
        self.rate_limiter = RateLimiter(config.sec.rate_limit)
        self._ticker_to_cik: dict[str, str] = {}
        self._cik_to_company: dict[str, str] = {}
        self._session: Optional[aiohttp.ClientSession] = None

    @property
    def headers(self) -> dict:
        """Return request headers with User-Agent."""
        return {
            "User-Agent": self.config.sec.user_agent,
            "Accept": "application/json",
        }

    async def __aenter__(self) -> "SECClient":
        """Create aiohttp session."""
        self._session = aiohttp.ClientSession(headers=self.headers)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Close aiohttp session."""
        if self._session:
            await self._session.close()

    async def _get(self, url: str) -> bytes:
        """Make a rate-limited GET request."""
        await self.rate_limiter.acquire()

        if not self._session:
            raise RuntimeError("Client not initialized. Use async with context manager.")

        @retry_with_backoff(max_attempts=5, exceptions=(aiohttp.ClientError,))
        async def _fetch():
            async with self._session.get(url) as response:
                response.raise_for_status()
                return await response.read()

        return await _fetch()

    async def _get_json(self, url: str) -> dict:
        """Make a rate-limited GET request and return JSON."""
        data = await self._get(url)
        import json
        return json.loads(data)

    async def load_ticker_mapping(self) -> None:
        """Load ticker to CIK mapping from SEC."""
        url = f"{self.config.sec.base_url}/files/company_tickers.json"
        logger.info(f"Loading ticker mapping from {url}")

        data = await self._get_json(url)

        for entry in data.values():
            ticker = entry["ticker"].upper()
            cik = str(entry["cik_str"]).zfill(10)
            company = entry["title"]
            self._ticker_to_cik[ticker] = cik
            self._cik_to_company[cik] = company

        logger.info(f"Loaded {len(self._ticker_to_cik)} ticker mappings")

    def get_cik(self, ticker: str) -> Optional[str]:
        """Get CIK for a ticker symbol."""
        return self._ticker_to_cik.get(ticker.upper())

    def get_company_name(self, cik: str) -> str:
        """Get company name for a CIK."""
        return self._cik_to_company.get(cik, "Unknown Company")

    async def get_filings(
        self,
        ticker: str,
        forms: Optional[list[str]] = None,
        max_filings: Optional[int] = None,
    ) -> list[FilingMetadata]:
        """Get filing metadata for a ticker.

        Args:
            ticker: Stock ticker symbol
            forms: List of form types to filter (e.g., ["10-K", "10-Q"])
            max_filings: Maximum number of filings to return

        Returns:
            List of FilingMetadata objects
        """
        if not self._ticker_to_cik:
            await self.load_ticker_mapping()

        cik = self.get_cik(ticker)
        if not cik:
            logger.error(f"Unknown ticker: {ticker}")
            return []

        url = f"{self.config.sec.data_url}/submissions/CIK{cik}.json"
        logger.info(f"Fetching submissions for {ticker} (CIK: {cik})")

        data = await self._get_json(url)
        company_name = data.get("name", self.get_company_name(cik))

        filings = []
        recent = data.get("filings", {}).get("recent", {})

        accession_numbers = recent.get("accessionNumber", [])
        form_types = recent.get("form", [])
        filing_dates = recent.get("filingDate", [])
        primary_documents = recent.get("primaryDocument", [])

        forms = forms or self.config.filings.forms

        for i, (accession, form, date_str, primary_doc) in enumerate(
            zip(accession_numbers, form_types, filing_dates, primary_documents)
        ):
            if form not in forms:
                continue

            filing_date = datetime.strptime(date_str, "%Y-%m-%d")

            filing = FilingMetadata(
                cik=cik,
                accession_number=accession,
                form=form,
                filing_date=filing_date,
                company_name=company_name,
                ticker=ticker.upper(),
                primary_document=primary_doc,
            )
            filings.append(filing)

            if max_filings and len(filings) >= max_filings:
                break

        logger.info(f"Found {len(filings)} filings for {ticker}")
        return filings

    async def get_filing_documents(
        self, filing: FilingMetadata
    ) -> list[DocumentInfo]:
        """Get list of documents in a filing.

        Args:
            filing: Filing metadata

        Returns:
            List of DocumentInfo objects for processable documents
        """
        url = (
            f"{self.config.sec.data_url}/submissions/"
            f"CIK{filing.cik}/000{filing.accession_no_dashes[3:]}.json"
        )

        try:
            data = await self._get_json(url)
        except aiohttp.ClientError:
            index_url = (
                f"{self.config.sec.base_url}/Archives/edgar/data/"
                f"{filing.cik}/{filing.accession_no_dashes}/index.json"
            )
            data = await self._get_json(index_url)

        documents = []
        doc_list = data.get("directory", {}).get("item", [])

        if not doc_list:
            if filing.primary_document:
                documents.append(
                    DocumentInfo(
                        sequence=1,
                        filename=filing.primary_document,
                        document_type=filing.form,
                        description=f"{filing.form} filing",
                    )
                )
            return documents

        for i, doc in enumerate(doc_list):
            filename = doc.get("name", "")

            if not filename.lower().endswith((".htm", ".html", ".txt")):
                continue

            if filename.lower().endswith((".xml", ".xsd")):
                continue

            documents.append(
                DocumentInfo(
                    sequence=i + 1,
                    filename=filename,
                    document_type=doc.get("type", "unknown"),
                    description=doc.get("description", ""),
                    size=doc.get("size"),
                )
            )

        return documents

    async def download_document(
        self,
        filing: FilingMetadata,
        document: DocumentInfo,
        download_dir: Path,
    ) -> Path:
        """Download a document to local storage.

        Args:
            filing: Filing metadata
            document: Document info
            download_dir: Base download directory

        Returns:
            Path to downloaded file
        """
        filing_dir = download_dir / filing.cik / filing.accession_no_dashes
        filing_dir.mkdir(parents=True, exist_ok=True)

        file_path = filing_dir / document.filename

        if file_path.exists():
            logger.debug(f"Document already downloaded: {file_path}")
            return file_path

        url = (
            f"{self.config.sec.base_url}/Archives/edgar/data/"
            f"{filing.cik}/{filing.accession_no_dashes}/{document.filename}"
        )

        logger.debug(f"Downloading {url}")
        content = await self._get(url)

        file_path.write_bytes(content)
        logger.info(f"Downloaded {document.filename} ({len(content)} bytes)")

        return file_path

    async def download_filing(
        self,
        filing: FilingMetadata,
        download_dir: Path,
        max_documents: Optional[int] = None,
    ) -> list[tuple[DocumentInfo, Path]]:
        """Download all documents for a filing.

        Args:
            filing: Filing metadata
            download_dir: Base download directory
            max_documents: Maximum documents to download

        Returns:
            List of (DocumentInfo, Path) tuples
        """
        documents = await self.get_filing_documents(filing)

        if max_documents:
            documents = documents[:max_documents]

        results = []
        for doc in documents:
            try:
                path = await self.download_document(filing, doc, download_dir)
                results.append((doc, path))
            except Exception as e:
                logger.error(f"Failed to download {doc.filename}: {e}")

        return results
