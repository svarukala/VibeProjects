# SEC Copilot Connector - Implementation Plan

## Overview
Python-based Microsoft Copilot Connector to import SEC EDGAR filings (10-K, 10-Q, DEF 14A, 8-K) for semantic indexing and LLM reasoning in Microsoft 365.

## Project Structure
```
C:\vibe\SEC-Connector\
├── pyproject.toml              # Dependencies and project config
├── config/
│   ├── config.yaml             # Main configuration
│   └── schema.json             # Graph connector schema
├── src/sec_connector/
│   ├── __init__.py
│   ├── __main__.py             # Entry point
│   ├── cli.py                  # Click-based CLI
│   ├── config.py               # Config loading
│   ├── models.py               # Pydantic data models
│   ├── sec_client.py           # SEC EDGAR API client
│   ├── parser.py               # SGML/HTML parsing & markdown conversion
│   ├── chunker.py              # Document chunking strategies
│   ├── graph_client.py         # Microsoft Graph API client
│   ├── state_manager.py        # SQLite-based state persistence
│   ├── pipeline.py             # Main orchestration
│   └── utils.py                # Retry, logging utilities
├── data/                       # Runtime data (gitignored)
│   ├── downloads/              # Cached SEC filings
│   ├── payloads/               # Saved upload payloads (--save-payloads)
│   ├── state.db                # Processing state
│   └── logs/                   # Log files
└── tests/
```

## Key Components

### 1. SEC EDGAR Client (`sec_client.py`)
- Ticker-to-CIK mapping via `sec.gov/files/company_tickers.json`
- Fetch filing metadata from `data.sec.gov/submissions/CIK{cik}.json`
- **Download raw filings to `data/downloads/{cik}/{accession}/`**
- Skip already-downloaded files (cache check)
- Rate limiting (10 req/sec) with retry logic

### Processing Pipeline
```
1. DISCOVER  → Fetch filing metadata from SEC API
2. DOWNLOAD  → Save raw .txt/.htm files to data/downloads/ (cached)
3. PARSE     → Extract content from disk, convert to Markdown
4. CHUNK     → Split into LLM-friendly segments
5. UPLOAD    → Batch upload to Microsoft Graph
```
Each stage checkpoints to SQLite - resume from any failure point.

### 2. Document Parser (`parser.py`)
- Parse SGML structure (`<DOCUMENT>`, `<TEXT>`, headers)
- Extract metadata (company, form, date, accession number)
- HTML-to-Markdown conversion pipeline (20+ transformations)
- Filter by file type (.htm, .txt only)

### 3. Content Chunker (`chunker.py`)
- **Max item size**: 4 MB per Graph external item (hard limit enforced)
- Page-based splitting (primary) using `<PAGE>` markers
- Section header splitting (secondary)
- Size-based fallback (3000-4000 chars target, ~4KB well under 4MB)
- 200-char overlap for context continuity
- Validation: reject/split any chunk exceeding 4 MB

### 4. State Manager (`state_manager.py`)
- SQLite database for tracking: `filings` and `chunks` tables
- State machine: PENDING → DOWNLOADED → PARSED → UPLOADED → COMPLETED
- Resume capability: pick up from any failed state
- Checkpoint after each batch upload

### 5. Graph Client (`graph_client.py`)
- MSAL authentication (client credentials flow)
- Connection and schema management
- Batch uploads (20 items per request)
- Exponential backoff for 429 rate limits

### 6. CLI Interface (`cli.py`)
```bash
# Quick test mode (1-2 filings, 5 pages max)
sec-connector ingest -t AAPL --test

# Full ingestion
sec-connector ingest -t AAPL,MSFT,GOOG

# Save upload payloads as JSON to data/payloads/ (off by default)
sec-connector ingest -t AAPL --test --save-payloads
sec-connector ingest -t AAPL,MSFT,GOOG --save-payloads

# Resume interrupted processing
sec-connector resume

# Resume with payload saving
sec-connector resume --save-payloads

# Check status
sec-connector status
```

## Schema Properties (for Graph Connector)
| Property | Type | Searchable | Queryable | Purpose |
|----------|------|------------|-----------|---------|
| Title | String | ✓ | ✓ | "Company - Form - Date" |
| Company | String | ✓ | ✓ | Company name |
| Ticker | String | ✓ | ✓ | Stock symbol |
| Form | String | ✓ | ✓ | 10-K, 10-Q, etc. |
| FilingDate | DateTime | | ✓ | Filing date |
| Description | String | ✓ | | Document description |
| Url | String | | | SEC EDGAR link |
| CIK | String | | ✓ | SEC identifier |
| AccessionNumber | String | | | Unique filing ID |
| Sequence | Int64 | | | Doc sequence |
| Page | Int64 | | | Page/chunk number |

## Dependencies
- **click** + **rich**: CLI with progress bars
- **aiohttp**: Async HTTP client (5 concurrent downloads)
- **msal**: Microsoft authentication
- **beautifulsoup4** + **lxml**: HTML parsing
- **markdownify**: HTML to Markdown (including tables)
- **pydantic**: Data validation
- **tenacity**: Retry logic
- **pyyaml**: Configuration
- **aiosqlite**: Async SQLite for state

## Design Decisions
- **Async processing**: 5 concurrent downloads for faster ingestion
- **Tables**: Convert to Markdown format for LLM reasoning
- **Azure**: User has app registration ready (env vars expected)

## Test Mode (Quick Validation)
- `--test` flag limits: 1 ticker, 2 filings, 5 pages each
- Total: ~10 items uploaded for quick end-to-end validation
- Full processing mode removes all limits

## Robustness Features
1. **Retry Logic**: Exponential backoff (5 retries, 4-60s delays)
2. **Progress Logging**: Structured logs with timestamps
3. **Resume Capability**: SQLite state tracks every item
4. **Rate Limiting**: Respects SEC (10/s) and Graph (429) limits
5. **Error Isolation**: Failed items don't block batch processing

## Verification Steps
1. Run `sec-connector setup` to create Graph connection
2. Run `sec-connector ingest -t AAPL --test --save-payloads` for quick test with payload inspection
3. Review saved payloads in `data/payloads/{ticker}/{accession}/` to verify content before upload
4. Verify items in Microsoft 365 Admin → Search & Intelligence → Connectors
5. Test in Copilot: "What are Apple's recent SEC filings?"
6. Run full ingestion with desired tickers

## Configuration (config/config.yaml)
```yaml
sec:
  user_agent: "SEC-Connector/1.0 (your-email@example.com)"
  rate_limit: 10

azure:
  tenant_id: ${AZURE_TENANT_ID}
  client_id: ${AZURE_CLIENT_ID}
  client_secret: ${AZURE_CLIENT_SECRET}
  connection_id: "sec-filings"

filings:
  forms: ["10-K", "10-Q", "8-K", "DEF 14A"]

chunking:
  target_size: 4000
  max_size: 8000
  overlap: 200

test_mode:
  max_filings: 2
  max_pages: 5
```
