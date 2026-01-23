# MCS Declarative Agent to SharePoint Agent Converter

A PowerShell utility that converts Microsoft Copilot Studio (MCS) declarative agent export files into SharePoint `.agent` files.

---

## Disclaimer

> **THIS SCRIPT IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.**
>
> **IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SCRIPT OR THE USE OR OTHER DEALINGS IN THE SCRIPT.**
>
> This script is provided as a sample/reference implementation only. Before using in a production environment, you must:
> - Thoroughly review and understand the code
> - Test in a non-production environment
> - Validate the output meets your requirements
> - Take full ownership and responsibility for its use
>
> **The customer/user assumes all risks associated with using this script.**

---

## Overview

When you export a declarative agent from Microsoft Copilot Studio, you receive a `.zip` file containing agent configuration. This script converts that export into a SharePoint-compatible `.agent` file format.

### What the Script Does

1. Extracts the MCS agent zip file
2. Reads the `declarativeAgent_0.json` configuration
3. Authenticates to Microsoft Graph API
4. Resolves SharePoint URLs to their corresponding IDs (site_id, web_id, list_id, unique_id)
5. Converts the agent icon to base64
6. Generates a SharePoint `.agent` file

---

## Prerequisites

### 1. PowerShell 7.x

This script requires PowerShell 7.x or later.

**Check your version:**
```powershell
$PSVersionTable.PSVersion
```

**Download PowerShell 7:** https://github.com/PowerShell/PowerShell/releases

### 2. Microsoft Graph PowerShell Modules

Install the Microsoft Graph modules at the system level (requires Administrator privileges):

```powershell
# Run PowerShell as Administrator
Install-Module Microsoft.Graph -Scope AllUsers
```

**Required modules:**
- `Microsoft.Graph.Authentication`
- `Microsoft.Graph.Sites`
- `Microsoft.Graph.Files`

**Verify installation:**
```powershell
Get-Module -ListAvailable Microsoft.Graph.Authentication
Get-Module -ListAvailable Microsoft.Graph.Sites
Get-Module -ListAvailable Microsoft.Graph.Files
```

The modules should be located at: `C:\Program Files\PowerShell\Modules`

### 3. Microsoft 365 Account with Permissions

The account used for authentication must have:
- **Sites.Read.All** - Read access to SharePoint sites
- **Files.Read.All** - Read access to files in SharePoint/OneDrive

### 4. MCS Agent Export File

Export your declarative agent from Microsoft Copilot Studio as a `.zip` file.

---

## Installation

1. Download or clone this repository to your local machine:
   ```
   C:\Scripts\MCS-DA-to-SPO-Agent\
   ```

2. Ensure the script file exists:
   ```
   C:\Scripts\MCS-DA-to-SPO-Agent\Convert-MCSAgentToSPOAgent.ps1
   ```

---

## Usage

### Basic Usage

Convert an agent using the default output location (same folder as the zip file):

```powershell
.\Convert-MCSAgentToSPOAgent.ps1 -ZipFilePath "C:\Exports\MyAgent.zip"
```

### Specify Output Directory

Convert an agent and save the output to a specific folder:

```powershell
.\Convert-MCSAgentToSPOAgent.ps1 -ZipFilePath "C:\Exports\MyAgent.zip" -OutputPath "C:\Output\Agents"
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `-ZipFilePath` | Yes | Full path to the MCS agent zip file |
| `-OutputPath` | No | Output directory for the `.agent` file. Defaults to the same directory as the zip file |

---

## Example Walkthrough

### Step 1: Export Agent from Copilot Studio

1. Open Microsoft Copilot Studio
2. Navigate to your declarative agent
3. Export the agent as a Teams App (zip file)
4. Save the file (e.g., `MyAgent-TeamsApp.zip`)

### Step 2: Run the Conversion Script

```powershell
cd C:\Scripts\MCS-DA-to-SPO-Agent
.\Convert-MCSAgentToSPOAgent.ps1 -ZipFilePath "C:\Downloads\MyAgent-TeamsApp.zip" -OutputPath "C:\Output"
```

### Step 3: Authenticate

When prompted, select your authentication method:

```
========================================
  AUTHENTICATION REQUIRED
========================================
1. Interactive (browser popup) [Recommended]
2. Device Code (manual entry)
========================================
Select authentication method [1]:
```

**Option 1 (Recommended):** A browser window opens for you to sign in with your Microsoft 365 account.

**Option 2:** You'll receive a device code to enter at https://microsoft.com/devicelogin

### Step 4: Wait for URL Resolution

The script will resolve each SharePoint URL in the agent configuration:

```
[6/7] Resolving SharePoint URLs...

  [1/5] https://contoso.sharepoint.com/sites/Marketing/Shared%20Documents/Guides/Welcome.docx
  Type: DirectFile
    GET https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/Marketing
    GET https://graph.microsoft.com/v1.0/sites/.../drives
    Matched library: Documents (https://contoso.sharepoint.com/sites/Marketing/Shared Documents)
    GET https://graph.microsoft.com/v1.0/drives/.../list?$select=id
    GET https://graph.microsoft.com/v1.0/drives/.../root:/Guides/Welcome.docx
  Resolved: Welcome.docx (File)
```

### Step 5: Output

Upon completion, you'll see:

```
=====================================================
  Conversion Complete!
=====================================================

  Output file: C:\Output\MyAgent.agent
```

---

## Sample Output

The generated `.agent` file follows this structure:

```json
{
  "schemaVersion": "0.2.0",
  "customCopilotConfig": {
    "conversationStarters": {
      "conversationStarterList": [
        { "text": "Summarize recent files" },
        { "text": "How can you help me?" }
      ],
      "welcomeMessage": {
        "text": "Ask a question or get started with one of these prompts:"
      }
    },
    "gptDefinition": {
      "name": "My Agent",
      "description": "Agent description here",
      "instructions": "Agent instructions here",
      "capabilities": [
        { "name": "WebSearch" },
        {
          "name": "OneDriveAndSharePoint",
          "items_by_sharepoint_ids": [...],
          "items_by_url": [...]
        }
      ]
    },
    "icon": "data:image/png;base64,..."
  }
}
```

---

## Troubleshooting

### Error: "Required modules are not installed"

**Solution:** Install Microsoft Graph modules as Administrator:
```powershell
Install-Module Microsoft.Graph -Scope AllUsers
```

### Error: "Failed to connect to Microsoft Graph"

**Solution:** Try authenticating manually first:
```powershell
Connect-MgGraph -Scopes 'Sites.Read.All','Files.Read.All'
```
Then run the script again.

### Error: "Could not find a part of the path"

**Solution:** The output directory doesn't exist. The script should create it automatically. If it fails, create it manually:
```powershell
New-Item -ItemType Directory -Path "C:\Output" -Force
```

### Error: "Failed to get site info"

**Possible causes:**
- The SharePoint site doesn't exist
- You don't have access to the site
- The URL is malformed

**Solution:** Verify you can access the SharePoint site in a browser with the same account.

### Error: "Item not found"

**Possible causes:**
- The file or folder has been moved or deleted
- You don't have access to the item

**Solution:** Verify the file exists and you have access to it.

### Device Code Not Showing

If the device code doesn't appear when using device code authentication:

1. Select option 1 (Interactive) instead
2. Or authenticate manually first:
   ```powershell
   Connect-MgGraph -Scopes 'Sites.Read.All','Files.Read.All'
   ```

---

## File Structure

```
MCS-DA-to-SPO-Agent/
├── Convert-MCSAgentToSPOAgent.ps1    # Main conversion script
├── README.md                          # This documentation
├── claude.md                          # Technical implementation details
└── Sample/
    ├── MyAgent-TeamsApp.zip           # Sample input (MCS export)
    └── MyAgent.agent                  # Sample output (SharePoint agent)
```

---

## Support

This script is provided as-is for reference purposes. For issues or questions:

1. Review the troubleshooting section above
2. Check the `claude.md` file for technical implementation details
3. Review the Graph API calls shown in the script output to diagnose issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial release |

