"""SQLite-based state persistence for processing checkpoints."""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiosqlite

from .models import ChunkRecord, ChunkState, FilingMetadata, FilingRecord, FilingState
from .utils import get_logger

logger = get_logger("state_manager")


class StateManager:
    """Manages processing state in SQLite database."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._db: Optional[aiosqlite.Connection] = None

    async def __aenter__(self) -> "StateManager":
        """Initialize database connection."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._init_schema()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Close database connection."""
        if self._db:
            await self._db.close()

    async def _init_schema(self) -> None:
        """Create database schema if not exists."""
        await self._db.executescript("""
            CREATE TABLE IF NOT EXISTS filings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cik TEXT NOT NULL,
                accession_number TEXT NOT NULL,
                ticker TEXT NOT NULL,
                company_name TEXT NOT NULL,
                form TEXT NOT NULL,
                filing_date TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(cik, accession_number)
            );

            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filing_id INTEGER NOT NULL,
                chunk_id TEXT NOT NULL UNIQUE,
                page_number INTEGER NOT NULL,
                sequence INTEGER NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (filing_id) REFERENCES filings(id)
            );

            CREATE INDEX IF NOT EXISTS idx_filings_state ON filings(state);
            CREATE INDEX IF NOT EXISTS idx_filings_ticker ON filings(ticker);
            CREATE INDEX IF NOT EXISTS idx_chunks_state ON chunks(state);
            CREATE INDEX IF NOT EXISTS idx_chunks_filing ON chunks(filing_id);
        """)
        await self._db.commit()

    async def add_filing(self, filing: FilingMetadata) -> int:
        """Add a filing to track.

        Args:
            filing: Filing metadata

        Returns:
            Filing ID
        """
        # Try insert first
        try:
            cursor = await self._db.execute(
                """
                INSERT INTO filings (cik, accession_number, ticker, company_name, form, filing_date, state)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    filing.cik,
                    filing.accession_number,
                    filing.ticker,
                    filing.company_name,
                    filing.form,
                    filing.filing_date.isoformat(),
                    FilingState.PENDING.value,
                ),
            )
            await self._db.commit()
            return cursor.lastrowid
        except Exception:
            # On conflict, update and get existing id
            await self._db.execute(
                """
                UPDATE filings SET
                    ticker = ?,
                    company_name = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE cik = ? AND accession_number = ?
                """,
                (filing.ticker, filing.company_name, filing.cik, filing.accession_number),
            )
            await self._db.commit()
            cursor = await self._db.execute(
                "SELECT id FROM filings WHERE cik = ? AND accession_number = ?",
                (filing.cik, filing.accession_number),
            )
            row = await cursor.fetchone()
            return row["id"]

    async def get_filing_id(self, cik: str, accession_number: str) -> Optional[int]:
        """Get filing ID by CIK and accession number."""
        cursor = await self._db.execute(
            "SELECT id FROM filings WHERE cik = ? AND accession_number = ?",
            (cik, accession_number),
        )
        row = await cursor.fetchone()
        return row["id"] if row else None

    async def update_filing_state(
        self,
        filing_id: int,
        state: FilingState,
        error_message: Optional[str] = None,
    ) -> None:
        """Update filing processing state."""
        await self._db.execute(
            """
            UPDATE filings
            SET state = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (state.value, error_message, filing_id),
        )
        await self._db.commit()

    async def get_filings_by_state(self, state: FilingState) -> list[FilingRecord]:
        """Get all filings in a specific state."""
        cursor = await self._db.execute(
            "SELECT * FROM filings WHERE state = ?",
            (state.value,),
        )
        rows = await cursor.fetchall()
        return [
            FilingRecord(
                id=row["id"],
                cik=row["cik"],
                accession_number=row["accession_number"],
                ticker=row["ticker"],
                company_name=row["company_name"],
                form=row["form"],
                filing_date=datetime.fromisoformat(row["filing_date"]),
                state=FilingState(row["state"]),
                error_message=row["error_message"],
            )
            for row in rows
        ]

    async def add_chunk(
        self,
        filing_id: int,
        chunk_id: str,
        page_number: int,
        sequence: int,
    ) -> int:
        """Add a chunk to track.

        Returns:
            Chunk ID
        """
        # Try insert first
        try:
            cursor = await self._db.execute(
                """
                INSERT INTO chunks (filing_id, chunk_id, page_number, sequence, state)
                VALUES (?, ?, ?, ?, ?)
                """,
                (filing_id, chunk_id, page_number, sequence, ChunkState.PENDING.value),
            )
            await self._db.commit()
            return cursor.lastrowid
        except Exception:
            # On conflict, update and get existing id
            await self._db.execute(
                """
                UPDATE chunks SET updated_at = CURRENT_TIMESTAMP
                WHERE chunk_id = ?
                """,
                (chunk_id,),
            )
            await self._db.commit()
            cursor = await self._db.execute(
                "SELECT id FROM chunks WHERE chunk_id = ?",
                (chunk_id,),
            )
            row = await cursor.fetchone()
            return row["id"]

    async def update_chunk_state(
        self,
        chunk_id: str,
        state: ChunkState,
        error_message: Optional[str] = None,
    ) -> None:
        """Update chunk processing state."""
        await self._db.execute(
            """
            UPDATE chunks
            SET state = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE chunk_id = ?
            """,
            (state.value, error_message, chunk_id),
        )
        await self._db.commit()

    async def update_chunks_batch(
        self,
        chunk_ids: list[str],
        state: ChunkState,
    ) -> None:
        """Update multiple chunks to the same state."""
        placeholders = ",".join("?" * len(chunk_ids))
        await self._db.execute(
            f"""
            UPDATE chunks
            SET state = ?, updated_at = CURRENT_TIMESTAMP
            WHERE chunk_id IN ({placeholders})
            """,
            (state.value, *chunk_ids),
        )
        await self._db.commit()

    async def get_pending_chunks(self, filing_id: int) -> list[ChunkRecord]:
        """Get pending or failed chunks for a filing (for retry)."""
        cursor = await self._db.execute(
            "SELECT * FROM chunks WHERE filing_id = ? AND state IN (?, ?)",
            (filing_id, ChunkState.PENDING.value, ChunkState.FAILED.value),
        )
        rows = await cursor.fetchall()
        return [
            ChunkRecord(
                id=row["id"],
                filing_id=row["filing_id"],
                chunk_id=row["chunk_id"],
                page_number=row["page_number"],
                sequence=row["sequence"],
                state=ChunkState(row["state"]),
                error_message=row["error_message"],
            )
            for row in rows
        ]

    async def get_stats(self) -> dict:
        """Get processing statistics."""
        stats = {}

        cursor = await self._db.execute(
            "SELECT state, COUNT(*) as count FROM filings GROUP BY state"
        )
        rows = await cursor.fetchall()
        stats["filings"] = {row["state"]: row["count"] for row in rows}

        cursor = await self._db.execute(
            "SELECT state, COUNT(*) as count FROM chunks GROUP BY state"
        )
        rows = await cursor.fetchall()
        stats["chunks"] = {row["state"]: row["count"] for row in rows}

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM filings")
        row = await cursor.fetchone()
        stats["total_filings"] = row["count"]

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM chunks")
        row = await cursor.fetchone()
        stats["total_chunks"] = row["count"]

        return stats

    async def get_resume_candidates(self) -> list[FilingRecord]:
        """Get filings that have pending or failed chunks to retry."""
        cursor = await self._db.execute(
            """
            SELECT DISTINCT f.* FROM filings f
            INNER JOIN chunks c ON f.id = c.filing_id
            WHERE c.state IN (?, ?)
            ORDER BY f.created_at
            """,
            (ChunkState.PENDING.value, ChunkState.FAILED.value),
        )
        rows = await cursor.fetchall()
        return [
            FilingRecord(
                id=row["id"],
                cik=row["cik"],
                accession_number=row["accession_number"],
                ticker=row["ticker"],
                company_name=row["company_name"],
                form=row["form"],
                filing_date=datetime.fromisoformat(row["filing_date"]),
                state=FilingState(row["state"]),
                error_message=row["error_message"],
            )
            for row in rows
        ]

    async def check_all_chunks_uploaded(self, filing_id: int) -> bool:
        """Check if all chunks for a filing have been uploaded."""
        cursor = await self._db.execute(
            """
            SELECT COUNT(*) as pending FROM chunks
            WHERE filing_id = ? AND state != ?
            """,
            (filing_id, ChunkState.UPLOADED.value),
        )
        row = await cursor.fetchone()
        return row["pending"] == 0
