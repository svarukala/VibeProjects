# AgentAnalyzer

A responsive web application for analyzing Microsoft 365 Copilot agent zip files, providing best practice recommendations and improvement suggestions.

## Project Overview

AgentAnalyzer allows users to upload Copilot agent packages (.zip files), inspect their contents, edit configuration files, and receive AI-powered recommendations for improving agent quality based on Microsoft best practices.

### Core Capabilities

- **Agent Package Analysis**: Unpack and analyze Copilot agent zip files
- **File Browser & Editor**: View and edit JSON/image files within the package
- **Agent Type Detection**: Identify Declarative Agents (DA) vs Custom Agents (CA)
- **Best Practice Recommendations**: AI-powered analysis using OpenAI endpoints
- **Deep Analysis**: Optional in-depth analysis of SharePoint, Copilot Connectors, and API Connectors (requires sign-in)
- **Package Repackaging**: Download modified agent packages as zip files
- **Optional M365 Authentication**: Enhanced features for signed-in users via MSAL

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | HTML5, CSS3, JavaScript (Vanilla or lightweight framework) |
| UI Design | Microsoft Fluent UI Web Components |
| Authentication | MSAL.js (Microsoft Authentication Library) |
| SharePoint/Graph API | Microsoft Graph JavaScript SDK |
| Zip Handling | JSZip library |
| Code Editor | Monaco Editor or CodeMirror |
| AI Analysis | OpenAI API (configurable endpoint) |
| File Syntax Highlighting | Prism.js or highlight.js |

## Architecture

```
AgentAnalyzer/
├── index.html              # Main entry point
├── css/
│   ├── styles.css          # Global styles
│   ├── fluent-overrides.css # Fluent UI customizations
│   └── components/         # Component-specific styles
├── js/
│   ├── app.js              # Main application logic
│   ├── config.js           # Configuration (Entra ID, OpenAI endpoint)
│   ├── auth/
│   │   └── msal-auth.js    # MSAL authentication handling
│   ├── services/
│   │   ├── zip-service.js      # Zip/unzip operations
│   │   ├── file-service.js     # File parsing and manipulation
│   │   ├── agent-parser.js     # Agent manifest parsing
│   │   ├── analysis-service.js # OpenAI integration for recommendations
│   │   ├── graph-service.js    # Microsoft Graph API client
│   │   ├── sharepoint-analyzer.js   # SharePoint knowledge source analysis
│   │   ├── connector-analyzer.js    # Copilot & API connector analysis
│   │   └── deep-analysis-service.js # Orchestrates deep analysis features
│   ├── components/
│   │   ├── file-tree.js        # Left navigation file browser
│   │   ├── file-viewer.js      # Right pane file viewer/editor
│   │   ├── agent-details.js    # Agent information display
│   │   ├── analysis-panel.js   # Recommendations display
│   │   ├── deep-analysis-options.js # Deep analysis checkboxes UI
│   │   ├── deep-analysis-results.js # Deep analysis results display
│   │   └── drag-drop.js        # Drag and drop upload handler
│   └── utils/
│       ├── file-utils.js       # File type detection, formatting
│       └── schema-validator.js # Manifest schema validation
├── assets/
│   └── icons/              # UI icons
└── config/
    └── app-config.json     # Runtime configuration
```

## Configuration

### Entra ID (Azure AD) Configuration
```javascript
// config.js - MSAL Configuration (make these configurable)
const msalConfig = {
    auth: {
        clientId: "<YOUR_CLIENT_ID>",
        authority: "https://login.microsoftonline.com/<YOUR_TENANT_ID>",
        redirectUri: window.location.origin
    }
};
```

### Microsoft Graph Scopes (for Deep Analysis)
```javascript
// config.js - Graph API scopes for SharePoint access
const graphScopes = {
    sharePoint: [
        "Sites.Read.All",           // Read SharePoint sites
        "Files.Read.All",           // Read files in SharePoint
        "InformationProtection.Read.All"  // Read sensitivity labels
    ]
};
```

### OpenAI Configuration
```javascript
// config.js - OpenAI Configuration (make these configurable)
const openAIConfig = {
    endpoint: "<YOUR_OPENAI_ENDPOINT>",
    apiKey: "<YOUR_API_KEY>",  // Should be handled securely
    model: "gpt-4"
};
```

## Key Features & Requirements

### 1. Authentication (Optional for Basic, Required for Deep Analysis)
- Users can use the app without signing in for basic analysis
- Sign-in **required** for Deep Analysis features (SharePoint, Connectors)
- Use MSAL.js for Microsoft 365 authentication
- Entra ID configuration must be externally configurable
- Request additional Graph API scopes when user enables Deep Analysis
- Show clear indication when features require sign-in

### 2. File Upload
- Support drag-and-drop onto the web app
- Support traditional file picker upload
- Accept only `.zip` files
- Show upload progress indicator

### 3. File Browser (Left Pane)
- Display extracted files in a tree structure
- Icons based on file type (JSON, images)
- Collapsible folder structure
- Click to select and view file

### 4. File Viewer/Editor (Right Pane)
- Syntax highlighting based on file extension
- JSON files: Pretty-printed with collapsible sections
- Image files: Preview display
- Edit mode with:
  - Undo functionality
  - Save changes
  - Cancel/revert changes
- Only editable for text-based files (JSON, etc.)

### 5. Agent Detection & Details Display

#### Declarative Agent (DA) Detection
A package is a **Declarative Agent** if `manifest.json` contains:
```json
{
    "copilotAgents": {
        "declarativeAgents": [...]
    }
}
```

#### Custom Agent (CA)
If no `declarativeAgents` section exists, classify as Custom Agent (show "TBD" placeholder for now).

#### DA Details Extraction
Parse the referenced `.json` file from `declarativeAgents` section:
- **Schema Reference**: Use version to determine schema (e.g., v1.5 → [Schema 1.5 docs](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-manifest-1.5?tabs=json))
- Display:
  - Agent Name
  - Agent Description
  - Instructions (expandable/collapsible - usually large text)
  - Boolean properties (as toggles/badges)
  - Enumerated values (as labeled chips)
  - Starter prompts

### 6. AI-Powered Analysis

#### Trigger
- **Manual only**: Provide "Analyze Agent" button
- Do NOT auto-analyze on upload

#### Best Practices Sources
Compare agent configuration against:
- [Declarative Agent Instructions Guide](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-instructions)
- [Generative Mode Guidance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-mode-guidance)
- [Authoring Instructions](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-instructions)

#### Analysis Areas
1. **Instructions Quality**: Check for clarity, completeness, specificity
2. **Description Quality**: Ensure meaningful and accurate descriptions
3. **Starter Prompts**: Analyze and suggest improvements
4. **General Best Practices**: Compliance with Microsoft guidelines

#### Output Format
- Categorized recommendations (Critical, Warning, Suggestion)
- Specific improvement suggestions with examples
- Before/after comparisons where applicable

### 7. Deep Analysis (Requires Sign-In)

Deep Analysis provides in-depth inspection of the agent's connected resources. Users must be signed in to Microsoft 365 to use these features.

#### UI: Deep Analysis Options
Display checkboxes allowing users to select which deep analysis to perform:
```
┌─────────────────────────────────────────────────────────────┐
│  Deep Analysis Options (requires sign-in)                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ☐ SharePoint Knowledge Sources                        ││
│  │  ☐ Copilot Connectors                                  ││
│  │  ☐ API Connectors                                      ││
│  └─────────────────────────────────────────────────────────┘│
│  [Run Deep Analysis]                                        │
└─────────────────────────────────────────────────────────────┘
```

- Checkboxes disabled with tooltip "Sign in required" if user not authenticated
- "Run Deep Analysis" button disabled until at least one option selected
- Show progress indicator during analysis

---

#### 7a. SharePoint Analysis

Analyzes SharePoint knowledge sources referenced in the agent configuration.

##### Detection
Parse the declarative agent JSON to find SharePoint knowledge sources:
- Look for `capabilities.OneDriveAndSharePoint` section
- Extract site URLs, library paths, and direct file links

##### Library Analysis (Iterative)
When knowledge source points to a SharePoint library:

| Check | Description | Red Flag Threshold |
|-------|-------------|-------------------|
| **Total File Count** | Recursively count all files in library | Informational |
| **Average File Size** | Calculate mean file size | Informational |
| **Large Files** | Identify files exceeding 80MB | Warning: Any file >80MB |
| **Sensitivity Labels** | Check for files with sensitivity labels applied | Warning: Files with restrictive labels |
| **Excel Documents** | Detect `.xlsx`, `.xls`, `.xlsm` files | Recommendation trigger |

##### Direct File Link Analysis
When knowledge source contains direct links to specific files:
- Perform the same checks as above on the individual file
- Report file size, sensitivity label status, and file type

##### SharePoint Recommendations

| Condition | Recommendation |
|-----------|----------------|
| Excel files detected | "**Enable Code Interpreter**: Your knowledge source contains Excel documents. Enable the Code Interpreter capability in your agent to allow data analysis and calculations." |
| Files >80MB found | "**Large File Warning**: Files exceeding 80MB may cause performance issues or timeouts. Consider breaking large documents into smaller sections." |
| Sensitivity labels detected | "**Access Warning**: Some files have sensitivity labels that may restrict the agent's ability to access content. Verify the agent's service principal has appropriate permissions." |
| Very high file count (>1000) | "**Performance Advisory**: Large number of files may impact response times. Consider using more specific folder paths or file filters." |

##### SharePoint Analysis Output
```
SharePoint Knowledge Source Analysis
────────────────────────────────────
Source: https://contoso.sharepoint.com/sites/Sales/Documents

📊 Statistics:
   • Total Files: 847
   • Average File Size: 2.3 MB
   • Total Size: ~1.9 GB

⚠️ Red Flags:
   • 3 files exceed 80MB limit
     - Q4Report.xlsx (92MB)
     - AllCustomers.xlsx (105MB)
     - ProductCatalog.pdf (81MB)
   • 12 files have sensitivity labels
   • 45 Excel documents detected

💡 Recommendations:
   • Enable Code Interpreter for Excel file analysis
   • Consider splitting large files or excluding from knowledge source
   • Review sensitivity label permissions
```

---

#### 7b. Copilot Connectors Analysis

Analyzes Copilot Connectors (Microsoft Graph Connectors) referenced in the agent.

##### Detection
Parse the declarative agent JSON to find connector references:
- Look for `capabilities.GraphConnectors` section
- Extract connector IDs and configurations

##### Connector Checks

| Check | Description |
|-------|-------------|
| **Connector Count** | Count total number of connectors configured |
| **Description Quality** | Verify each connector has a meaningful description |
| **Description Length** | Check description is neither too short (<20 chars) nor too long (>500 chars) |

##### Copilot Connector Recommendations

| Condition | Recommendation |
|-----------|----------------|
| Missing description | "**Add Connector Description**: Connector '{name}' is missing a description. Add a clear description to help Copilot understand when to use this connector." |
| Too many connectors (>5) | "**Reduce Connector Count**: Your agent uses {count} connectors. Consider reducing the number of connectors or splitting functionality into child agents for better performance and accuracy." |
| Short description | "**Improve Description**: Connector '{name}' has a very brief description. Expand it to clearly explain the data source and when it should be queried." |
| Vague description | "**Clarify Description**: Connector '{name}' description is too generic. Be specific about what data it contains and its use cases." |

##### Copilot Connector Output
```
Copilot Connectors Analysis
───────────────────────────
Total Connectors: 7

⚠️ Issues Found:
   • Too many connectors configured (7 > recommended 5)
   • Connector "SalesData" missing description
   • Connector "HR_Records" description too short (15 chars)

💡 Recommendations:
   • Consider using child agents to distribute connector load
   • Add description to "SalesData": Explain what sales information is available
   • Expand "HR_Records" description to clarify available employee data
```

---

#### 7c. API Connectors Analysis

Analyzes API Plugin/Connector JSON files within the agent package.

##### Detection
Parse the agent package to find API connector definitions:
- Look for `capabilities.Plugins` or `capabilities.Actions` in declarative agent JSON
- Locate referenced OpenAPI specification files (`.json`, `.yaml`)
- Find plugin manifest files

##### API Connector Checks

| Check | Description |
|-------|-------------|
| **JSON Validity** | Ensure all JSON files are well-formed |
| **OpenAPI Compliance** | Validate against OpenAPI 3.0 specification |
| **Operation Descriptions** | Check each operation has a description |
| **Parameter Descriptions** | Verify parameters have descriptions |
| **Response Descriptions** | Check response schemas are documented |
| **Server URLs** | Validate server URLs are properly configured |

##### API Connector Recommendations

| Condition | Recommendation |
|-----------|----------------|
| Malformed JSON | "**Fix JSON Syntax**: File '{filename}' contains invalid JSON at line {line}. Error: {error}" |
| Missing operation description | "**Add Operation Description**: Operation '{operationId}' in '{filename}' lacks a description. Describe what this endpoint does." |
| Missing parameter description | "**Document Parameters**: Parameter '{param}' in operation '{operationId}' needs a description for Copilot to use it correctly." |
| No examples provided | "**Add Examples**: Consider adding example values for parameters and responses to improve Copilot's understanding." |
| Ambiguous operationIds | "**Clarify Operation Names**: Operation IDs should be descriptive. Consider renaming '{operationId}' to better reflect its purpose." |

##### API Connector Output
```
API Connectors Analysis
───────────────────────
Files Analyzed: 3

📄 weather-api.json
   ✅ Valid JSON
   ✅ OpenAPI 3.0 compliant
   ⚠️ 2 operations missing descriptions
   ⚠️ 5 parameters without descriptions

📄 crm-plugin.json
   ✅ Valid JSON
   ✅ All operations documented
   💡 Consider adding response examples

💡 Recommendations:
   • Add descriptions to: GET /forecast, POST /alerts
   • Document parameters: city, date, format, limit, offset
   • Add example responses to improve Copilot accuracy
```

---

### 8. Repackaging
- "Download Package" button
- Re-zip all files (including edits)
- Preserve original folder structure
- Download as `.zip` file

## UI/UX Guidelines

### Fluent UI Design Principles
- Use [Fluent UI Web Components](https://docs.microsoft.com/en-us/fluent-ui/web-components/)
- Consistent spacing using Fluent design tokens
- Accessible color contrast
- Responsive breakpoints:
  - Desktop: Side-by-side panels
  - Tablet: Collapsible file tree
  - Mobile: Stacked panels with navigation

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | App Title | Sign In/User Profile           │
├─────────────────────────────────────────────────────────────┤
│  Upload Area (when no file loaded)                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │     Drag & Drop Zone / Browse Button                    ││
│  └─────────────────────────────────────────────────────────┘│
├───────────────┬─────────────────────────────────────────────┤
│  File Tree    │  Main Content Area                          │
│  (Left Nav)   │  ┌─────────────────────────────────────────┐│
│               │  │  Agent Details Card (DA/CA badge)       ││
│  📁 root      │  │  - Name, Description                    ││
│  ├─ 📄 file1  │  │  - Instructions (expandable)            ││
│  ├─ 📄 file2  │  │  - Properties                           ││
│  └─ 📁 folder │  └─────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────┐│
│               │  │  Analysis Options                       ││
│               │  │  [Analyze Agent] - Basic Analysis       ││
│               │  │  ─────────────────────────────────────  ││
│               │  │  Deep Analysis (requires sign-in):      ││
│               │  │  ☐ SharePoint  ☐ Connectors  ☐ APIs    ││
│               │  │  [Run Deep Analysis]                    ││
│               │  └─────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────┐│
│               │  │  File Viewer/Editor                     ││
│               │  │  (when file selected)                   ││
│               │  └─────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────┐│
│               │  │  Analysis Results Panel                 ││
│               │  │  - Basic Analysis Results               ││
│               │  │  - Deep Analysis Results (tabbed)       ││
│               │  │    [SharePoint] [Connectors] [APIs]     ││
│               │  └─────────────────────────────────────────┘│
├───────────────┴─────────────────────────────────────────────┤
│  Footer: [Download Package] | Status                        │
└─────────────────────────────────────────────────────────────┘
```

## Coding Standards

### General
- Use ES6+ JavaScript features
- Modular code organization (ES modules)
- JSDoc comments for public functions
- Meaningful variable and function names
- Error handling with user-friendly messages

### File Naming
- kebab-case for files: `agent-parser.js`
- PascalCase for classes: `class AgentParser {}`
- camelCase for functions/variables: `parseManifest()`

### CSS
- BEM naming convention for custom classes
- CSS custom properties for theming
- Mobile-first responsive approach

### Security
- Sanitize file contents before display
- Validate zip file structure
- No sensitive data in client-side config (use environment variables or secure config service)
- CSP headers recommended for production

## Dependencies (Recommended)

```json
{
    "dependencies": {
        "@fluentui/web-components": "^2.x",
        "@azure/msal-browser": "^3.x",
        "@microsoft/microsoft-graph-client": "^3.x",
        "jszip": "^3.x",
        "monaco-editor": "^0.45.x",
        "prismjs": "^1.x",
        "swagger-parser": "^10.x"
    }
}
```

**Note**: `swagger-parser` is used for OpenAPI/Swagger validation in API Connector analysis.

## Future Enhancements (Out of Scope for Initial Version)
- Custom Agent (CA) detailed analysis
- Side-by-side diff view for changes
- Export analysis report as PDF/Word
- Batch processing multiple packages
- Direct deployment to Microsoft 365 via Graph API
- Version history/comparison
- Auto-fix suggestions (apply recommended changes automatically)
- SharePoint content preview within the app
- Connector health status check (live connectivity test)

## Reference Documentation

### Agent Development
- [Declarative Agent Manifest 1.5 Schema](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-manifest-1.5?tabs=json)
- [Declarative Agent Instructions Best Practices](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-instructions)
- [Copilot Studio Generative Mode Guidance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-mode-guidance)
- [Copilot Studio Authoring Instructions](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-instructions)

### Microsoft Graph & SharePoint
- [Microsoft Graph JavaScript SDK](https://learn.microsoft.com/en-us/graph/sdks/sdks-overview)
- [SharePoint Files API](https://learn.microsoft.com/en-us/graph/api/resources/driveitem)
- [List SharePoint Drive Items](https://learn.microsoft.com/en-us/graph/api/driveitem-list-children)
- [Sensitivity Labels API](https://learn.microsoft.com/en-us/graph/api/resources/security-sensitivitylabel)

### Authentication & UI
- [MSAL.js Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-js-overview)
- [Fluent UI Web Components](https://docs.microsoft.com/en-us/fluent-ui/web-components/)

### API Specifications
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)

### How to run
 python -m http.server 8000