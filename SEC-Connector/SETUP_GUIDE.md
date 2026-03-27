# SEC Copilot Connector - Setup Guide

A comprehensive guide to setting up and running the SEC Copilot Connector, which imports SEC EDGAR filings into Microsoft 365 for semantic search and Copilot reasoning.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Azure App Registration](#azure-app-registration)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Running the Connector](#running-the-connector)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Overview

The SEC Copilot Connector is a Python-based Microsoft Graph Connector that:

- Fetches SEC EDGAR filings (10-K, 10-Q, 8-K, DEF 14A) for specified companies
- Converts HTML/SGML filings to searchable Markdown
- Uploads content to Microsoft 365 for indexing
- Enables Microsoft Copilot to reason over SEC filings

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   SEC EDGAR     │────▶│  SEC Connector   │────▶│  Microsoft Graph    │
│   (Filings)     │     │  (This Tool)     │     │  (External Items)   │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                           │
                                                           ▼
                                                 ┌─────────────────────┐
                                                 │  Microsoft Copilot  │
                                                 │  (Search & Reason)  │
                                                 └─────────────────────┘
```

---

## Prerequisites

### 1. System Requirements

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Python | 3.10+ | Python 3.11 or 3.12 recommended |
| pip | Latest | For package installation |
| Operating System | Windows 10/11, macOS, Linux | Windows recommended for enterprise |

### 2. Microsoft 365 Requirements

- **Microsoft 365 Business** or **Enterprise** subscription
- **Microsoft Entra ID** (formerly Azure AD) tenant
- **Admin access** to create App Registrations
- **Search Administrator** or **Global Administrator** role (for connector setup)

### 3. Required Accounts

- Microsoft Azure account with admin access
- SEC EDGAR access (free, no registration required)

---

## Azure App Registration

You must create an Azure App Registration to authenticate with Microsoft Graph.

### Step 1: Navigate to Azure Portal

1. Go to [https://portal.azure.com](https://portal.azure.com)
2. Sign in with your admin account

### Step 2: Create App Registration

1. Search for **"App registrations"** in the top search bar
2. Click **"App registrations"**
3. Click **"+ New registration"**

4. Fill in the registration form:
   - **Name**: `SEC Copilot Connector` (or your preferred name)
   - **Supported account types**: Select **"Accounts in this organizational directory only"**
   - **Redirect URI**: Leave blank (not needed for this app)

5. Click **"Register"**

### Step 3: Note Your Application IDs

After registration, you'll see the **Overview** page. Copy these values:

| Field | Environment Variable | Example |
|-------|---------------------|---------|
| Application (client) ID | `AZURE_CLIENT_ID` | `4d79e88d-603b-4284-a90d-c6bf32cdfc8e` |
| Directory (tenant) ID | `AZURE_TENANT_ID` | `144b8c80-398d-405e-8055-fc9a9d5013f8` |

### Step 4: Create Client Secret

1. In your App Registration, click **"Certificates & secrets"** in the left menu
2. Click **"+ New client secret"**
3. Fill in:
   - **Description**: `SEC Connector Secret`
   - **Expires**: Select an appropriate duration (e.g., 12 months)
4. Click **"Add"**
5. **IMPORTANT**: Copy the **Value** immediately (you won't see it again!)

| Field | Environment Variable |
|-------|---------------------|
| Secret Value | `AZURE_CLIENT_SECRET` |

### Step 5: Configure API Permissions

1. Click **"API permissions"** in the left menu
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Application permissions"** (not Delegated)
5. Search for and select these permissions:

| Permission | Description |
|------------|-------------|
| `ExternalConnection.ReadWrite.OwnedBy` | Create and manage external connections |
| `ExternalItem.ReadWrite.OwnedBy` | Create and manage external items |

6. Click **"Add permissions"**

### Step 6: Grant Admin Consent

1. Still on the **API permissions** page
2. Click **"Grant admin consent for [Your Organization]"**
3. Click **"Yes"** to confirm
4. Verify all permissions show a green checkmark under "Status"

### Verification Checklist

Before proceeding, confirm:

- [ ] App Registration created
- [ ] Application (client) ID copied
- [ ] Directory (tenant) ID copied
- [ ] Client secret created and value copied
- [ ] API permissions added (ExternalConnection.ReadWrite.OwnedBy, ExternalItem.ReadWrite.OwnedBy)
- [ ] Admin consent granted (green checkmarks visible)

---

## Installation

### Step 1: Clone or Download the Project

```powershell
# If using Git
git clone <repository-url>
cd SEC-Connector

# Or download and extract the ZIP file
```

### Step 2: Create Virtual Environment (Recommended)

```powershell
# Windows
python -m venv venv
.\venv\Scripts\Activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install the Package

```powershell
# Install in development mode
pip install -e .

# Or install dependencies only
pip install -r requirements.txt
```

### Step 4: Verify Installation

```powershell
sec-connector --help
```

Expected output:
```
Usage: sec-connector [OPTIONS] COMMAND [ARGS]...

  SEC Copilot Connector - Import SEC EDGAR filings into Microsoft 365.

Options:
  -c, --config PATH         Path to config file
  -n, --connection-id TEXT  Connection ID for Graph connector (alphanumeric only)
  -v, --verbose             Enable verbose logging
  --help                    Show this message and exit.

Commands:
  ingest  Ingest SEC filings for specified tickers.
  reset   Reset the connector (delete connection and state).
  resume  Resume interrupted processing.
  setup   Set up the Graph connector and schema.
  status  Show processing status.
```

---

## Configuration

### Step 1: Set Environment Variables

Set the Azure credentials as environment variables:

#### Windows (PowerShell) - Current Session

```powershell
$env:AZURE_TENANT_ID = "your-tenant-id"
$env:AZURE_CLIENT_ID = "your-client-id"
$env:AZURE_CLIENT_SECRET = "your-client-secret"
```

#### Windows (PowerShell) - Permanent

```powershell
[Environment]::SetEnvironmentVariable("AZURE_TENANT_ID", "your-tenant-id", "User")
[Environment]::SetEnvironmentVariable("AZURE_CLIENT_ID", "your-client-id", "User")
[Environment]::SetEnvironmentVariable("AZURE_CLIENT_SECRET", "your-client-secret", "User")
```

#### macOS/Linux

```bash
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"

# Add to ~/.bashrc or ~/.zshrc for persistence
```

### Step 2: Verify Environment Variables

```powershell
# Windows PowerShell
echo $env:AZURE_TENANT_ID
echo $env:AZURE_CLIENT_ID
echo $env:AZURE_CLIENT_SECRET

# macOS/Linux
echo $AZURE_TENANT_ID
echo $AZURE_CLIENT_ID
echo $AZURE_CLIENT_SECRET
```

### Step 3: Configuration File (Optional)

The default configuration is in `config/config.yaml`. You can customize:

```yaml
sec:
  user_agent: "SEC-Connector/1.0 (your-email@example.com)"  # Update with your email
  rate_limit: 10  # SEC API rate limit (requests/second)

azure:
  tenant_id: ${AZURE_TENANT_ID}
  client_id: ${AZURE_CLIENT_ID}
  client_secret: ${AZURE_CLIENT_SECRET}
  connection_id: "pysecfilings"           # Default, can be overridden via CLI
  connection_name: "SEC EDGAR Filings"    # Display name in Microsoft 365 Admin Center
  connection_description: "SEC EDGAR filings including 10-K, 10-Q, 8-K, and DEF 14A forms"

filings:
  forms: ["10-K", "10-Q", "8-K", "DEF 14A"]  # Filing types to process

chunking:
  target_size: 4000   # Target chunk size (characters)
  max_size: 8000      # Maximum chunk size
  overlap: 200        # Overlap between chunks

processing:
  concurrent_downloads: 5   # Parallel SEC downloads
  batch_size: 20            # Items per Graph API batch upload
  ocr_images: true          # OCR rotated-text images (e.g., vertical column headers)

test_mode:
  max_filings: 2      # Filings per ticker in test mode
  max_pages: 5        # Pages per filing in test mode
```

> **OCR Note**: When `ocr_images` is `true` (or the `--ocr` CLI flag is used), the parser downloads images referenced in SEC filings and runs OCR to recover text from rotated-text images. This is common in financial tables where column headers are rendered as rotated image labels (which would otherwise appear as `LOGO` placeholders). Requires `easyocr` or `pytesseract` to be installed.

---

## Running the Connector

### Step 1: Setup the Graph Connection

Run the setup command to create the Microsoft Graph connection and schema:

```powershell
sec-connector setup
```

You'll be prompted to enter a connector name. The connection ID is derived automatically:

```
Graph Connector Configuration
The connection name identifies your connector in Microsoft 365.
The connection ID (alphanumeric) is derived automatically.

Enter a name for your connector [SEC Filings]: My SEC Filings

  Connection name: My SEC Filings
  Connection ID:   mysecfilings

Use this connection? [Y/n]: y
Connection name: My SEC Filings
Connection ID:   mysecfilings
Setting up Graph connector...
Waiting for schema to be ready (this may take a few minutes)...
Schema is ready
Setup complete! Connection is ready.
```

You can also provide the connection name and ID directly via CLI options:

```powershell
# Provide both name and ID
sec-connector setup --connection-name "PNC SEC Filings" -n pncsecfilings

# Provide just the ID (name defaults to the ID value)
sec-connector setup -n mysecfilings
```

**Note**: Schema provisioning can take 2-5 minutes. The command will wait automatically.

### Step 2: Test with a Single Ticker

Run a test ingestion with limited data:

```powershell
sec-connector ingest -t AAPL --test -n mysecfilings
```

To also enable OCR for rotated-text images (column headers rendered as images):

```powershell
sec-connector ingest -t AAPL --test -n mysecfilings --ocr
```

> **Tip**: If `ocr_images: true` is set in `config/config.yaml`, OCR is enabled by default and the `--ocr` flag is not needed.

Expected output:
```
SEC Connector - Ingesting filings for: AAPL
Connection: SEC EDGAR Filings (mysecfilings)
OCR enabled for rotated-text images
Running in TEST MODE
Test mode: 2 filings, 5 pages max
...
Ingestion Complete!

┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━┓
┃ Metric             ┃ Value ┃
┡━━━━━━━━━━━━━━━━━━━━╇━━━━━━━┩
│ Tickers processed  │ 1     │
│ Filings discovered │ 2     │
│ Filings downloaded │ 2     │
│ Filings parsed     │ 2     │
│ Chunks created     │ 10    │
│ Chunks uploaded    │ 10    │
│ Errors             │ 0     │
└────────────────────┴───────┘

All items processed successfully!
```

### Step 3: Full Ingestion

Once testing is successful, run a full ingestion:

```powershell
# Single ticker
sec-connector ingest -t AAPL -n mysecfilings

# Multiple tickers
sec-connector ingest -t AAPL,MSFT,GOOG,AMZN -n mysecfilings

# With limits
sec-connector ingest -t AAPL --max-filings 10 -n mysecfilings

# With OCR enabled (if not already enabled in config.yaml)
sec-connector ingest -t AAPL -n mysecfilings --ocr

# Save upload payloads as JSON for inspection
sec-connector ingest -t AAPL -n mysecfilings --save-payloads

# With a custom display name
sec-connector ingest -t AAPL -n mysecfilings --connection-name "My SEC Filings"
```

### Step 4: Monitor Progress

Check the status of your ingestion:

```powershell
sec-connector status -n mysecfilings
```

Output:
```
Connection: SEC EDGAR Filings (mysecfilings)

Processing Status:

       Filings
┏━━━━━━━━━━━┳━━━━━━━┓
┃ State     ┃ Count ┃
┡━━━━━━━━━━━╇━━━━━━━┩
│ completed │ 134   │
│ failed    │ 0     │
│ Total     │ 134   │
└───────────┴───────┘

       Chunks
┏━━━━━━━━━━┳━━━━━━━━┓
┃ State    ┃ Count  ┃
┡━━━━━━━━━━╇━━━━━━━━┩
│ uploaded │ 36,837 │
│ failed   │ 0      │
│ Total    │ 36,837 │
└──────────┴────────┘
```

### Step 5: Resume Failed Uploads

If any uploads failed (e.g., due to network issues), resume them:

```powershell
# Resume with OCR (if not enabled in config)
sec-connector resume -n mysecfilings --ocr

# Resume with payload saving
sec-connector resume -n mysecfilings --save-payloads
```

---

## Usage Examples

### Basic Commands

```powershell
# Setup a new connector (interactive prompt)
sec-connector setup

# Setup with explicit name and ID
sec-connector setup --connection-name "PNC SEC Filings" -n pncsecfilings

# Ingest filings for Apple
sec-connector ingest -t AAPL -n mysecfilings

# Ingest filings for multiple companies
sec-connector ingest -t AAPL,MSFT,GOOG -n mysecfilings

# Test mode (limited data)
sec-connector ingest -t AAPL --test -n mysecfilings

# Ingest with OCR for rotated-text images
sec-connector ingest -t AAPL -n mysecfilings --ocr

# Save upload payloads as JSON for inspection
sec-connector ingest -t AAPL --test -n mysecfilings --save-payloads

# Check status
sec-connector status -n mysecfilings

# Resume failed uploads
sec-connector resume -n mysecfilings

# Reset everything (delete connection and data)
sec-connector reset -n mysecfilings
```

### Advanced Options

```powershell
# Limit number of filings per ticker
sec-connector ingest -t AAPL --max-filings 5 -n mysecfilings

# Limit pages per filing
sec-connector ingest -t AAPL --max-pages 10 -n mysecfilings

# Verbose logging
sec-connector -v ingest -t AAPL -n mysecfilings

# Use custom config file
sec-connector -c /path/to/config.yaml ingest -t AAPL -n mysecfilings

# Custom display name for Microsoft 365 Admin Center
sec-connector ingest -t AAPL -n mysecfilings --connection-name "Apple SEC Filings"

# OCR + save payloads + test mode (all flags combined)
sec-connector ingest -t AAPL --test --ocr --save-payloads -n mysecfilings
```

### OCR for Rotated-Text Images

SEC filings often contain financial tables where column headers are rendered as rotated images (appearing as `LOGO` in raw output). The OCR feature downloads these images and extracts the actual text.

**Enable via config (persistent):**
```yaml
# config/config.yaml
processing:
  ocr_images: true
```

**Enable via CLI flag (per-run):**
```powershell
sec-connector ingest -t AAPL -n mysecfilings --ocr
sec-connector resume -n mysecfilings --ocr
```

**Requirements**: Install one of the supported OCR backends:
```powershell
# Option 1: EasyOCR (recommended, pure Python)
pip install easyocr

# Option 2: pytesseract (requires Tesseract binary)
pip install pytesseract
```

### Popular Ticker Symbols

| Company | Ticker |
|---------|--------|
| Apple | AAPL |
| Microsoft | MSFT |
| Google (Alphabet) | GOOG |
| Amazon | AMZN |
| Tesla | TSLA |
| Meta (Facebook) | META |
| NVIDIA | NVDA |
| JPMorgan Chase | JPM |
| Bank of America | BAC |
| Wells Fargo | WFC |

---

## Troubleshooting

### Common Errors

#### 1. "Azure credentials not configured"

**Cause**: Environment variables not set.

**Solution**:
```powershell
# Verify variables are set
echo $env:AZURE_TENANT_ID
echo $env:AZURE_CLIENT_ID
echo $env:AZURE_CLIENT_SECRET

# Set them if missing
$env:AZURE_TENANT_ID = "your-tenant-id"
$env:AZURE_CLIENT_ID = "your-client-id"
$env:AZURE_CLIENT_SECRET = "your-client-secret"
```

#### 2. "Graph API error 403: Forbidden"

**Cause**: Missing or incorrect API permissions.

**Solution**:
1. Go to Azure Portal → App registrations → Your app → API permissions
2. Verify these permissions are added:
   - `ExternalConnection.ReadWrite.OwnedBy`
   - `ExternalItem.ReadWrite.OwnedBy`
3. Click "Grant admin consent" and confirm

#### 3. "Graph API error 400: Connection Id can only have ASCII alphanumeric characters"

**Cause**: Connection ID contains invalid characters.

**Solution**: Use only letters and numbers in your connection ID:
```powershell
# Good
sec-connector setup -n mysecfilings

# Bad (will be auto-sanitized)
sec-connector setup -n "my-sec-filings"  # Becomes: mysecfilings
```

#### 4. "Graph API error 503: Service Unavailable"

**Cause**: Microsoft Graph API temporarily unavailable.

**Solution**: The connector has automatic retry logic. If errors persist:
```powershell
# Resume failed uploads
sec-connector resume -n mysecfilings

# Resume with OCR if needed
sec-connector resume -n mysecfilings --ocr
```

#### 5. "maximum recursion depth exceeded"

**Cause**: SEC filing has deeply nested HTML.

**Solution**: This is handled automatically. The parser falls back to text extraction.

#### 6. Schema provisioning takes too long

**Cause**: Microsoft Graph schema provisioning can take several minutes.

**Solution**: Wait up to 5 minutes. If it times out:
```powershell
# Run setup again - it will detect existing schema
sec-connector setup -n mysecfilings
```

### Checking Logs

Logs are stored in `data/logs/`:

```powershell
# View latest log
Get-ChildItem data/logs/*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content

# Search for errors
Select-String -Path data/logs/*.log -Pattern "ERROR"
```

### Resetting Everything

If you need to start fresh:

```powershell
# Delete connection and local state
sec-connector reset -n mysecfilings

# Recreate
sec-connector setup -n mysecfilings
```

---

## FAQ

### Q: How long does ingestion take?

**A**: Depends on the number of filings:
- Test mode (2 filings): ~1-2 minutes
- Single ticker (all filings): ~5-15 minutes
- Multiple tickers: Scale accordingly

### Q: How much storage does this use?

**A**:
- Local cache (data/downloads): ~50-200 MB per ticker
- Microsoft 365: Varies by content, typically <1 GB total

### Q: Can I run multiple connectors?

**A**: Yes, use different connection IDs:
```powershell
sec-connector setup -n techstocks
sec-connector setup -n financials
```

### Q: How do I update filings?

**A**: Re-run ingestion. Existing items will be updated:
```powershell
sec-connector ingest -t AAPL -n mysecfilings
```

### Q: Where can I search the ingested content?

**A**:
1. **Microsoft 365 Admin Center** → Search & intelligence → Data sources
2. **Microsoft Copilot** in Teams, Word, etc.
3. **Microsoft Search** in SharePoint or Office.com

### Q: How do I delete specific filings?

**A**: Currently, use the reset command to delete all, then re-ingest what you need.

### Q: What does the `--ocr` flag do?

**A**: Many SEC financial tables have column headers rendered as rotated images (they show up as `LOGO` in the parsed output). The `--ocr` flag downloads those images from SEC.gov and runs OCR to recover the actual text (e.g., "Total Assets", "Net Income"). This significantly improves the quality of indexed content for financial tables. You can enable it permanently by setting `ocr_images: true` in `config/config.yaml`.

### Q: What is the difference between `--connection-id` and `--connection-name`?

**A**: The `--connection-id` (`-n`) is the alphanumeric identifier used by the Graph API (e.g., `pncsecfilings`). The `--connection-name` is the human-readable display name shown in the Microsoft 365 Admin Center (e.g., `PNC SEC Filings`). During interactive setup, both are derived from your input. Via CLI flags, you can set them independently.

### Q: What does `--save-payloads` do?

**A**: It saves the JSON payloads that would be uploaded to Microsoft Graph as files in `data/payloads/`. This is useful for inspecting the content before or after upload, debugging issues, or auditing what was sent to the Graph API.

---

## Support

- **Issues**: Check logs in `data/logs/`
- **Configuration**: Review `config/config.yaml`
- **Microsoft Graph**: [Graph API Documentation](https://learn.microsoft.com/en-us/graph/)
- **SEC EDGAR**: [SEC EDGAR Documentation](https://www.sec.gov/edgar)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-03 | Added OCR for rotated-text images (`--ocr` flag / `ocr_images` config), `--connection-name` option, `--save-payloads` option |
| 1.0.0 | 2026-02 | Initial release |
