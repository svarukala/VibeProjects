"""Main orchestration pipeline for SEC filing ingestion."""

import asyncio
import traceback
from pathlib import Path
from typing import Optional

from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeElapsedColumn,
)

from .chunker import chunk_with_limit
from .config import AppConfig, ensure_directories
from .graph_client import GraphClient
from .models import ChunkState, FilingMetadata, FilingState
from .parser import parse_document
from .sec_client import SECClient
from .state_manager import StateManager
from .utils import console, get_logger

logger = get_logger("pipeline")


class IngestionPipeline:
    """Orchestrates the full ingestion pipeline."""

    def __init__(self, config: AppConfig, test_mode: bool = False):
        self.config = config
        self.test_mode = test_mode
        self.download_dir = Path(config.paths.downloads)
        self.db_path = Path(config.paths.database)

    async def setup(self) -> None:
        """Set up Graph connection and schema."""
        async with GraphClient(self.config) as graph:
            console.print("[bold blue]Setting up Graph connector...[/]")

            # Check if connection and schema already exist and are ready
            try:
                status = await graph.get_schema_status()
                # Schema is ready if it has properties defined
                if status.get("properties"):
                    console.print("[bold green]Connection and schema already exist and are ready![/]")
                    return
                elif status.get("baseType"):
                    # Schema exists but may still be provisioning
                    console.print("[yellow]Schema exists, checking if ready...[/]")
                    ready = await graph.wait_for_schema(timeout=300)
                    if ready:
                        console.print("[bold green]Setup complete! Connection is ready.[/]")
                    else:
                        console.print("[bold red]Schema setup failed or timed out.[/]")
                        raise RuntimeError("Schema setup failed")
                    return
            except Exception:
                # Connection or schema doesn't exist, proceed with creation
                pass

            await graph.create_connection()

            await graph.register_schema()

            console.print("[yellow]Waiting for schema to be ready (this may take a few minutes)...[/]")
            ready = await graph.wait_for_schema(timeout=300)

            if ready:
                console.print("[bold green]Setup complete! Connection is ready.[/]")
            else:
                console.print("[bold red]Schema setup failed or timed out.[/]")
                raise RuntimeError("Schema setup failed")

    async def ingest(
        self,
        tickers: list[str],
        max_filings: Optional[int] = None,
        max_pages: Optional[int] = None,
    ) -> dict:
        """Run the full ingestion pipeline.

        Args:
            tickers: List of ticker symbols to process
            max_filings: Maximum filings per ticker (None for unlimited)
            max_pages: Maximum pages/chunks per filing (None for unlimited)

        Returns:
            Processing statistics
        """
        ensure_directories(self.config)

        if self.test_mode:
            tickers = tickers[:1]
            max_filings = max_filings or self.config.test_mode.max_filings
            max_pages = max_pages or self.config.test_mode.max_pages
            console.print(f"[yellow]Test mode: {max_filings} filings, {max_pages} pages max[/]")

        stats = {
            "tickers_processed": 0,
            "filings_discovered": 0,
            "filings_downloaded": 0,
            "filings_parsed": 0,
            "chunks_created": 0,
            "chunks_uploaded": 0,
            "errors": 0,
        }

        async with (
            SECClient(self.config) as sec,
            StateManager(self.db_path) as state,
            GraphClient(self.config) as graph,
        ):
            await sec.load_ticker_mapping()

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TaskProgressColumn(),
                TimeElapsedColumn(),
                console=console,
            ) as progress:

                ticker_task = progress.add_task(
                    "[cyan]Processing tickers...",
                    total=len(tickers),
                )

                for ticker in tickers:
                    try:
                        ticker_stats = await self._process_ticker(
                            ticker=ticker,
                            sec=sec,
                            state=state,
                            graph=graph,
                            progress=progress,
                            max_filings=max_filings,
                            max_pages=max_pages,
                        )

                        for key in ticker_stats:
                            stats[key] = stats.get(key, 0) + ticker_stats[key]

                        stats["tickers_processed"] += 1

                    except Exception as e:
                        logger.error(f"Error processing {ticker}: {e}")
                        stats["errors"] += 1

                    progress.update(ticker_task, advance=1)

        return stats

    async def _process_ticker(
        self,
        ticker: str,
        sec: SECClient,
        state: StateManager,
        graph: GraphClient,
        progress: Progress,
        max_filings: Optional[int],
        max_pages: Optional[int],
    ) -> dict:
        """Process all filings for a single ticker."""
        stats = {
            "filings_discovered": 0,
            "filings_downloaded": 0,
            "filings_parsed": 0,
            "chunks_created": 0,
            "chunks_uploaded": 0,
            "errors": 0,
        }

        filings = await sec.get_filings(
            ticker=ticker,
            forms=self.config.filings.forms,
            max_filings=max_filings,
        )

        stats["filings_discovered"] = len(filings)

        if not filings:
            logger.warning(f"No filings found for {ticker}")
            return stats

        filing_task = progress.add_task(
            f"[green]{ticker} filings",
            total=len(filings),
        )

        for filing in filings:
            try:
                filing_id = await state.add_filing(filing)

                await state.update_filing_state(filing_id, FilingState.PENDING)

                docs = await sec.download_filing(
                    filing=filing,
                    download_dir=self.download_dir,
                )
                stats["filings_downloaded"] += 1
                await state.update_filing_state(filing_id, FilingState.DOWNLOADED)

                all_chunks = []
                for doc_info, doc_path in docs:
                    parsed = parse_document(doc_path, filing, doc_info)
                    if not parsed:
                        continue

                    chunks = chunk_with_limit(
                        parsed,
                        self.config.chunking,
                        max_chunks=max_pages,
                    )
                    all_chunks.extend(chunks)

                stats["filings_parsed"] += 1
                await state.update_filing_state(filing_id, FilingState.PARSED)

                for chunk in all_chunks:
                    await state.add_chunk(
                        filing_id=filing_id,
                        chunk_id=chunk.chunk_id,
                        page_number=chunk.page_number,
                        sequence=chunk.document.sequence,
                    )

                stats["chunks_created"] += len(all_chunks)

                for i in range(0, len(all_chunks), self.config.processing.batch_size):
                    batch = all_chunks[i : i + self.config.processing.batch_size]
                    successful, failed = await graph.upload_items_batch(batch)

                    if successful:
                        await state.update_chunks_batch(successful, ChunkState.UPLOADED)
                        stats["chunks_uploaded"] += len(successful)

                    if failed:
                        for chunk_id in failed:
                            await state.update_chunk_state(
                                chunk_id, ChunkState.FAILED, "Upload failed"
                            )
                        stats["errors"] += len(failed)

                if await state.check_all_chunks_uploaded(filing_id):
                    await state.update_filing_state(filing_id, FilingState.COMPLETED)
                else:
                    await state.update_filing_state(filing_id, FilingState.UPLOADED)

            except Exception as e:
                logger.error(f"Error processing filing {filing.accession_number}: {e}\n{traceback.format_exc()}")
                stats["errors"] += 1
                try:
                    await state.update_filing_state(
                        filing_id, FilingState.FAILED, str(e)
                    )
                except:
                    pass

            progress.update(filing_task, advance=1)

        progress.remove_task(filing_task)
        return stats

    async def resume(self) -> dict:
        """Resume processing interrupted filings."""
        ensure_directories(self.config)

        stats = {
            "filings_resumed": 0,
            "chunks_uploaded": 0,
            "errors": 0,
        }

        async with (
            SECClient(self.config) as sec,
            StateManager(self.db_path) as state,
            GraphClient(self.config) as graph,
        ):
            await sec.load_ticker_mapping()

            candidates = await state.get_resume_candidates()

            if not candidates:
                console.print("[yellow]No filings to resume[/]")
                return stats

            console.print(f"[cyan]Found {len(candidates)} filings to resume[/]")

            for record in candidates:
                try:
                    pending_chunks = await state.get_pending_chunks(record.id)

                    if not pending_chunks:
                        await state.update_filing_state(record.id, FilingState.COMPLETED)
                        continue

                    filing = FilingMetadata(
                        cik=record.cik,
                        accession_number=record.accession_number,
                        form=record.form,
                        filing_date=record.filing_date,
                        company_name=record.company_name,
                        ticker=record.ticker,
                    )

                    docs = await sec.download_filing(
                        filing=filing,
                        download_dir=self.download_dir,
                    )

                    pending_ids = {c.chunk_id for c in pending_chunks}
                    chunks_to_upload = []

                    for doc_info, doc_path in docs:
                        parsed = parse_document(doc_path, filing, doc_info)
                        if not parsed:
                            continue

                        chunks = chunk_with_limit(parsed, self.config.chunking)
                        for chunk in chunks:
                            if chunk.chunk_id in pending_ids:
                                chunks_to_upload.append(chunk)

                    for i in range(0, len(chunks_to_upload), self.config.processing.batch_size):
                        batch = chunks_to_upload[i : i + self.config.processing.batch_size]
                        successful, failed = await graph.upload_items_batch(batch)

                        if successful:
                            await state.update_chunks_batch(successful, ChunkState.UPLOADED)
                            stats["chunks_uploaded"] += len(successful)

                        stats["errors"] += len(failed)

                    if await state.check_all_chunks_uploaded(record.id):
                        await state.update_filing_state(record.id, FilingState.COMPLETED)

                    stats["filings_resumed"] += 1

                except Exception as e:
                    logger.error(f"Error resuming {record.accession_number}: {e}")
                    stats["errors"] += 1

        return stats

    async def status(self) -> dict:
        """Get processing status."""
        ensure_directories(self.config)

        async with StateManager(self.db_path) as state:
            return await state.get_stats()

    async def reset(self) -> None:
        """Reset the connection (delete and recreate)."""
        async with GraphClient(self.config) as graph:
            console.print("[yellow]Deleting existing connection...[/]")
            try:
                await graph.delete_connection()
            except Exception as e:
                logger.warning(f"Could not delete connection: {e}")

            if self.db_path.exists():
                self.db_path.unlink()
                console.print("[yellow]Deleted state database[/]")

            console.print("[green]Reset complete. Run 'setup' to create a new connection.[/]")
