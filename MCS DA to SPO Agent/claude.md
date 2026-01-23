# MCS Declarative Agent to SharePoint Agent Converter

## Overview

PowerShell utility to convert Microsoft Copilot Studio (MCS) declarative agent zip files into SharePoint `.agent` files.

## Input/Output

**Input:** A `.zip` file exported from Microsoft Copilot Studio containing:
- `declarativeAgent_0.json` - Agent definition (v1.6 schema)
- `manifest.json` - Teams app manifest
- `color.png` / `outline.png` - Agent icons

**Output:** A `{agent_name}.agent` file - SharePoint agent format (schema v0.2.0)

## Schema Comparison

### Source: declarativeAgent_0.json (v1.6)
```json
{
  "version": "v1.6",
  "id": "string",
  "name": "string",
  "description": "string",
  "instructions": "string",
  "conversation_starters": [{ "text": "string", "title": "string" }],
  "capabilities": [
    { "name": "WebSearch" },
    { "name": "GraphConnectors", "connections": [{ "connection_id": "string" }] },
    { "name": "OneDriveAndSharePoint", "items_by_url": [{ "url": "string" }] }
  ]
}
```

### Target: .agent file (v0.2.0)
```json
{
  "schemaVersion": "0.2.0",
  "customCopilotConfig": {
    "conversationStarters": {
      "conversationStarterList": [{ "text": "string" }],
      "welcomeMessage": { "text": "string" }
    },
    "gptDefinition": {
      "name": "string",
      "description": "string",
      "instructions": "string",
      "capabilities": [
        { "name": "WebSearch" },
        { "name": "GraphConnectors", "connections": [{ "connection_id": "string" }] },
        {
          "name": "OneDriveAndSharePoint",
          "items_by_sharepoint_ids": [
            {
              "url": "string",
              "name": "string",
              "site_id": "guid",
              "web_id": "guid",
              "list_id": "guid",
              "unique_id": "guid",
              "type": "File"
            }
          ],
          "items_by_url": [
            {
              "url": "string",
              "name": "string",
              "site_id": "guid",
              "web_id": "guid",
              "list_id": "guid",
              "unique_id": "guid",
              "type": "Site|Folder"
            }
          ]
        }
      ],
      "behavior_overrides": {
        "special_instructions": { "discourage_model_knowledge": true }
      }
    },
    "icon": "data:image/png;base64,..."
  }
}
```

## Key Transformation Challenge

The declarativeAgent_0.json provides **only URLs** for SharePoint content, while the .agent file requires:
- `site_id` - SharePoint site GUID
- `web_id` - SharePoint web GUID
- `list_id` - Document library GUID
- `unique_id` - Item GUID (file/folder)
- `type` - "Site", "Folder", or "File"
- `name` - Display name

These IDs must be resolved via **Microsoft Graph API**.

## URL Types to Handle

1. **Site URL:** `https://{tenant}.sharepoint.com/sites/{sitename}`
   - Type: "Site"
   - list_id/unique_id: "00000000-0000-0000-0000-000000000000"

2. **Folder URL:** `https://{tenant}.sharepoint.com/sites/{sitename}/Shared%20Documents/{folder}`
   - Type: "Folder"
   - Requires resolving folder as drive item

3. **File URL (direct):** `https://{tenant}.sharepoint.com/sites/{sitename}/Shared%20Documents/{path}/file.docx`
   - Type: "File"

4. **File URL (Doc.aspx):** `https://{tenant}.sharepoint.com/sites/{sitename}/_layouts/15/Doc.aspx?sourcedoc={guid}&file=name.docx`
   - Type: "File"
   - unique_id can be extracted from sourcedoc parameter

## Implementation Plan

### Script: Convert-MCSAgentToSPOAgent.ps1

#### Parameters
```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$ZipFilePath,          # Path to MCS agent zip file

    [Parameter(Mandatory=$false)]
    [string]$OutputPath,           # Output directory (default: same as zip)

    [Parameter(Mandatory=$false)]
    [switch]$UseDeviceCode         # Use device code flow (default behavior)
)
```

#### Module Dependencies
Modules are loaded from system-level path: `C:\Program Files\PowerShell\Modules`

- `Microsoft.Graph.Authentication` - For Connect-MgGraph
- `Microsoft.Graph.Sites` - For Get-MgSite
- `Microsoft.Graph.Files` - For drive/file operations
- `System.IO.Compression` - For zip extraction (built-in .NET)

**Installation (run PowerShell as Administrator):**
```powershell
Install-Module Microsoft.Graph -Scope AllUsers
```

#### Step 1: Extract Zip File
```powershell
function Extract-AgentZip {
    param([string]$ZipPath, [string]$TempDir)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $TempDir)

    # Return paths to key files
    return @{
        DeclarativeAgent = Join-Path $TempDir "declarativeAgent_0.json"
        ColorIcon = Join-Path $TempDir "color.png"
    }
}
```

#### Step 2: Authenticate with MS Graph
```powershell
function Connect-ToMSGraph {
    # Required scopes for SharePoint site/file access
    $scopes = @(
        "Sites.Read.All",
        "Files.Read.All"
    )

    Connect-MgGraph -Scopes $scopes -UseDeviceCode
}
```

#### Step 3: Resolve SharePoint URLs to IDs

##### 3a. Parse URL Type
```powershell
function Get-SharePointUrlType {
    param([string]$Url)

    # Check if it's a Doc.aspx file link
    if ($Url -match "_layouts/15/Doc\.aspx") {
        return "DocAspxFile"
    }

    # Check if URL ends with file extension
    if ($Url -match "\.(docx|xlsx|pptx|pdf|txt|md)$") {
        return "DirectFile"
    }

    # Check if it's a site root (no path after site name)
    if ($Url -match "sharepoint\.com/sites/[^/]+/?$") {
        return "Site"
    }

    # Otherwise assume folder
    return "Folder"
}
```

##### 3b. Resolve Site Info
```powershell
function Get-SiteInfo {
    param([string]$Url)

    # Extract hostname and site path from URL
    # e.g., m365cpi05184678.sharepoint.com and /sites/FSI-Dev
    $uri = [System.Uri]$Url
    $hostname = $uri.Host

    # Extract site path
    if ($Url -match "/sites/([^/]+)") {
        $sitePath = "/sites/$($Matches[1])"
    }

    # Call MS Graph to get site
    $site = Get-MgSite -SiteId "${hostname}:${sitePath}"

    return @{
        SiteId = $site.Id.Split(',')[1]  # Format: tenant,siteId,webId
        WebId = $site.Id.Split(',')[2]
    }
}
```

##### 3c. Resolve Drive Item (File/Folder)
```powershell
function Get-DriveItemInfo {
    param(
        [string]$SiteId,
        [string]$ItemPath,  # Relative path within the site
        [string]$Url
    )

    # Get the default document library (drive)
    $drive = Get-MgSiteDrive -SiteId $SiteId | Where-Object { $_.Name -eq "Documents" }

    # Resolve item by path
    # Path format: /Shared Documents/folder/file.docx -> folder/file.docx
    $relativePath = $ItemPath -replace "^/?Shared%20Documents/?", ""
    $relativePath = [System.Web.HttpUtility]::UrlDecode($relativePath)

    $driveItem = Get-MgDriveItemByPath -DriveId $drive.Id -Path $relativePath

    return @{
        ListId = $drive.List.Id
        UniqueId = $driveItem.Id
        Name = $driveItem.Name
        Type = if ($driveItem.Folder) { "Folder" } else { "File" }
    }
}
```

##### 3d. Extract ID from Doc.aspx URL
```powershell
function Get-DocAspxFileInfo {
    param([string]$Url)

    # Extract sourcedoc GUID from URL
    # sourcedoc=%7BC1C3E135-F565-47FC-BD31-DF399DDF329A%7D
    if ($Url -match "sourcedoc=%7B([A-F0-9-]+)%7D") {
        $uniqueId = $Matches[1].ToLower()
    }

    # Extract file name
    if ($Url -match "file=([^&]+)") {
        $fileName = [System.Web.HttpUtility]::UrlDecode($Matches[1])
    }

    return @{
        UniqueId = $uniqueId
        Name = $fileName
    }
}
```

#### Step 4: Build .agent File Structure
```powershell
function Build-AgentFile {
    param(
        [object]$SourceAgent,
        [array]$ResolvedItems,
        [string]$IconBase64
    )

    # Separate items into files vs sites/folders
    $fileItems = $ResolvedItems | Where-Object { $_.Type -eq "File" }
    $otherItems = $ResolvedItems | Where-Object { $_.Type -ne "File" }

    $agentFile = @{
        schemaVersion = "0.2.0"
        customCopilotConfig = @{
            conversationStarters = @{
                conversationStarterList = $SourceAgent.conversation_starters | ForEach-Object {
                    @{ text = $_.text }
                }
                welcomeMessage = @{
                    text = "Ask a question or get started with one of these prompts:"
                }
            }
            gptDefinition = @{
                name = $SourceAgent.name
                description = $SourceAgent.description
                instructions = $SourceAgent.instructions
                capabilities = @()  # Will be built below
                behavior_overrides = @{
                    special_instructions = @{
                        discourage_model_knowledge = $true
                    }
                }
            }
            icon = "data:image/png;base64,$IconBase64"
        }
    }

    # Build capabilities array
    foreach ($cap in $SourceAgent.capabilities) {
        switch ($cap.name) {
            "WebSearch" {
                $agentFile.customCopilotConfig.gptDefinition.capabilities += @{
                    name = "WebSearch"
                }
            }
            "GraphConnectors" {
                $agentFile.customCopilotConfig.gptDefinition.capabilities += @{
                    name = "GraphConnectors"
                    connections = $cap.connections
                }
            }
            "OneDriveAndSharePoint" {
                $agentFile.customCopilotConfig.gptDefinition.capabilities += @{
                    name = "OneDriveAndSharePoint"
                    items_by_sharepoint_ids = $fileItems
                    items_by_url = $otherItems
                }
            }
        }
    }

    return $agentFile
}
```

#### Step 5: Write Output File
```powershell
function Export-AgentFile {
    param(
        [object]$AgentData,
        [string]$OutputPath,
        [string]$AgentName
    )

    $fileName = "$AgentName.agent"
    $fullPath = Join-Path $OutputPath $fileName

    $AgentData | ConvertTo-Json -Depth 20 | Set-Content -Path $fullPath -Encoding UTF8

    return $fullPath
}
```

### Main Script Flow

```powershell
# Main execution
try {
    # 1. Validate input
    if (-not (Test-Path $ZipFilePath)) {
        throw "Zip file not found: $ZipFilePath"
    }

    # 2. Create temp directory and extract
    $tempDir = New-Item -ItemType Directory -Path (Join-Path $env:TEMP (New-Guid))
    $files = Extract-AgentZip -ZipPath $ZipFilePath -TempDir $tempDir.FullName

    # 3. Load source agent definition
    $sourceAgent = Get-Content $files.DeclarativeAgent | ConvertFrom-Json

    # 4. Convert icon to base64
    $iconBytes = [System.IO.File]::ReadAllBytes($files.ColorIcon)
    $iconBase64 = [System.Convert]::ToBase64String($iconBytes)

    # 5. Connect to MS Graph
    Write-Host "Connecting to Microsoft Graph..."
    Connect-ToMSGraph

    # 6. Resolve all SharePoint URLs
    $resolvedItems = @()
    $spoCapability = $sourceAgent.capabilities | Where-Object { $_.name -eq "OneDriveAndSharePoint" }

    if ($spoCapability) {
        foreach ($item in $spoCapability.items_by_url) {
            Write-Host "Resolving: $($item.url)"
            $resolved = Resolve-SharePointUrl -Url $item.url
            $resolvedItems += $resolved
        }
    }

    # 7. Build agent file
    $agentData = Build-AgentFile -SourceAgent $sourceAgent -ResolvedItems $resolvedItems -IconBase64 $iconBase64

    # 8. Export
    $outputDir = if ($OutputPath) { $OutputPath } else { Split-Path $ZipFilePath -Parent }
    $outputFile = Export-AgentFile -AgentData $agentData -OutputPath $outputDir -AgentName $sourceAgent.name

    Write-Host "Agent file created: $outputFile"
}
finally {
    # Cleanup temp directory
    if ($tempDir -and (Test-Path $tempDir.FullName)) {
        Remove-Item $tempDir.FullName -Recurse -Force
    }

    # Disconnect from Graph
    Disconnect-MgGraph -ErrorAction SilentlyContinue
}
```

## MS Graph API Calls Required

### 1. Get Site by Path
```
GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{sitename}
```
**Response:** Returns site object with `id` in format `{tenantId},{siteId},{webId}`

### 2. Get Site Drives (Document Libraries)
```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drives
```
**Response:** Returns array of drives, filter for default "Documents" library

### 3. Get Drive Item by Path
```
GET https://graph.microsoft.com/v1.0/drives/{driveId}/root:/{path}
```
**Response:** Returns drive item with `id` (unique_id), `name`, and folder/file indicator

### 4. Get Drive Item by ID (for Doc.aspx files)
```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drives/{driveId}/items/{itemId}
```
**Response:** Returns drive item details including list info

## Required Graph Permissions

- `Sites.Read.All` - Read all site collections
- `Files.Read.All` - Read all files user can access

## Error Handling Considerations

1. **URL parsing failures** - Log and skip items that can't be parsed
2. **Graph API 404** - Site or file doesn't exist or user lacks access
3. **Graph API 403** - Insufficient permissions
4. **Rate limiting** - Implement retry with exponential backoff
5. **Disconnected session** - Handle token expiry, re-authenticate

## Testing Checklist

- [ ] Site URL resolution
- [ ] Folder URL resolution
- [ ] Direct file URL resolution
- [ ] Doc.aspx file URL resolution
- [ ] Multiple sites in single agent
- [ ] Icon conversion to base64
- [ ] Conversation starters mapping
- [ ] WebSearch capability passthrough
- [ ] GraphConnectors capability passthrough
- [ ] Output file JSON validity
- [ ] Output file opens correctly in SharePoint

## File Structure

```
MCS DA to SPO Agent/
├── Convert-MCSAgentToSPOAgent.ps1    # Main conversion script
├── claude.md                          # This documentation
└── Sample/
    ├── FSI-Dev agent-TeamsApp (1).zip # Sample input
    └── FSI-Dev agent.agent            # Expected output
```
