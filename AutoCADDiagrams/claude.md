# M365 Copilot Ecosystem Diagram Generator - Implementation Guide

## Project Overview

A Python CLI utility to generate architecture diagrams for Microsoft 365 Copilot ecosystem scenarios. Supports multiple input methods including templates, text descriptions, AI-assisted generation, and document parsing.

## Current Implementation Status

### Completed Features

| Feature | Status | Description |
|---------|--------|-------------|
| Core diagram generation | ✅ Done | Using `diagrams` library with GraphViz |
| Custom M365 icons | ✅ Done | Proxy classes for Copilot, Power Platform, Azure AI |
| Pre-built templates | ✅ Done | 6 templates for common patterns |
| CLI with Typer | ✅ Done | Commands: template, create, ai, ascii, info |
| ASCII output | ✅ Done | Text-based diagrams for terminals |
| AI integration | ✅ Done | Azure OpenAI / OpenAI API support |
| PNG output | ✅ Done | High-quality image generation |

### Project Structure

```
AutoCADDiagrams/
├── src/
│   └── m365_diagrams/
│       ├── __init__.py
│       ├── __main__.py           # Module entry point
│       ├── cli.py                # CLI commands
│       ├── generator.py          # Core diagram generation
│       ├── ai_assistant.py       # LLM integration
│       ├── ascii_renderer.py     # ASCII diagram output
│       ├── document_parser.py    # [NEW] Document parsing (Word/PDF)
│       ├── icons/
│       │   ├── __init__.py
│       │   └── m365_icons.py     # Custom M365 icon classes
│       └── templates/
│           ├── __init__.py
│           ├── copilot_studio.py
│           ├── power_platform.py
│           ├── azure_foundry.py
│           └── data_flows.py
├── templates/
│   └── prompts/
│       ├── diagram_generation.txt
│       └── document_analysis.txt  # [NEW] Prompt for document analysis
├── output/
├── requirements.txt
├── setup.py
├── claude.md                      # This file
└── README.md
```

---

## New Feature: Document Input Support

### Overview

Add capability to generate diagrams from Word (.docx) and PDF (.pdf) documents. The system will extract text content, analyze it to identify M365 components and data flows, then generate appropriate diagrams.

### CLI Commands (New)

```bash
# Generate diagram from a Word document
m365-diagram from-doc ./architecture.docx -o ./output/

# Generate diagram from a PDF document
m365-diagram from-doc ./design-spec.pdf -o ./output/

# With AI-assisted analysis (better results)
m365-diagram from-doc ./architecture.docx --use-ai -o ./output/

# Specify output format
m365-diagram from-doc ./spec.pdf --format ascii -o ./output/

# Extract and preview content only (no diagram)
m365-diagram from-doc ./spec.pdf --preview-only
```

### Dependencies (New)

Add to `requirements.txt`:
```
python-docx>=1.1.0      # Word document parsing
pypdf>=4.0.0            # PDF parsing (modern, maintained fork of PyPDF2)
```

### Implementation Plan

#### Phase 1: Document Parser Module

**File: `src/m365_diagrams/document_parser.py`**

```python
"""Document parsing for Word and PDF files."""

from pathlib import Path
from typing import Optional
import re


class DocumentParser:
    """Parses Word and PDF documents to extract text content."""

    SUPPORTED_EXTENSIONS = {'.docx', '.pdf', '.doc'}

    def __init__(self):
        self._check_dependencies()

    def _check_dependencies(self):
        """Check if required libraries are installed."""
        pass  # Raise ImportError with install instructions if missing

    def parse(self, file_path: str) -> dict:
        """Parse document and return structured content.

        Args:
            file_path: Path to the document file.

        Returns:
            dict with keys:
                - text: Full extracted text
                - sections: List of section headings and content
                - tables: Extracted tables (if any)
                - metadata: Document metadata
        """
        path = Path(file_path)

        if path.suffix.lower() == '.docx':
            return self._parse_docx(path)
        elif path.suffix.lower() == '.pdf':
            return self._parse_pdf(path)
        else:
            raise ValueError(f"Unsupported file type: {path.suffix}")

    def _parse_docx(self, path: Path) -> dict:
        """Parse Word document."""
        from docx import Document

        doc = Document(str(path))

        text_parts = []
        sections = []
        tables = []

        for para in doc.paragraphs:
            text_parts.append(para.text)
            # Detect headings
            if para.style.name.startswith('Heading'):
                sections.append({
                    'level': int(para.style.name[-1]) if para.style.name[-1].isdigit() else 1,
                    'title': para.text,
                    'content': ''
                })
            elif sections:
                sections[-1]['content'] += para.text + '\n'

        for table in doc.tables:
            table_data = []
            for row in table.rows:
                table_data.append([cell.text for cell in row.cells])
            tables.append(table_data)

        return {
            'text': '\n'.join(text_parts),
            'sections': sections,
            'tables': tables,
            'metadata': {
                'author': doc.core_properties.author,
                'title': doc.core_properties.title,
            }
        }

    def _parse_pdf(self, path: Path) -> dict:
        """Parse PDF document."""
        from pypdf import PdfReader

        reader = PdfReader(str(path))

        text_parts = []
        for page in reader.pages:
            text_parts.append(page.extract_text())

        return {
            'text': '\n'.join(text_parts),
            'sections': [],  # PDF doesn't have native sections
            'tables': [],    # Table extraction from PDF is complex
            'metadata': {
                'author': reader.metadata.author if reader.metadata else None,
                'title': reader.metadata.title if reader.metadata else None,
            }
        }

    def extract_components(self, parsed_doc: dict) -> dict:
        """Extract M365 components from parsed document.

        Uses keyword matching to identify mentioned components.

        Returns:
            dict of component flags (same format as generator._parse_description)
        """
        text = parsed_doc['text'].lower()

        return {
            'has_user': any(w in text for w in ['user', 'employee', 'end user', 'worker']),
            'has_copilot': 'copilot' in text and 'studio' not in text,
            'has_copilot_studio': 'copilot studio' in text or 'custom agent' in text,
            'has_sharepoint': 'sharepoint' in text,
            'has_teams': 'teams' in text and 'microsoft teams' in text or 'ms teams' in text,
            'has_graph_api': any(w in text for w in ['graph api', 'microsoft graph', 'msgraph']),
            'has_dataverse': 'dataverse' in text,
            'has_power_automate': any(w in text for w in ['power automate', 'flow', 'workflow automation']),
            'has_power_apps': any(w in text for w in ['power apps', 'powerapps', 'canvas app', 'model-driven']),
            'has_power_bi': any(w in text for w in ['power bi', 'powerbi', 'dashboard', 'report']),
            'has_azure_openai': any(w in text for w in ['azure openai', 'gpt-4', 'gpt-3.5', 'llm', 'large language model']),
            'has_azure_ai_search': any(w in text for w in ['ai search', 'cognitive search', 'vector search', 'rag']),
            'has_azure_foundry': any(w in text for w in ['ai foundry', 'azure ai', 'prompt flow', 'model catalog']),
            'has_connector': any(w in text for w in ['connector', 'api', 'integration', 'third-party', 'webhook']),
            'has_sql': any(w in text for w in ['sql server', 'azure sql', 'database']),
            'has_blob_storage': any(w in text for w in ['blob storage', 'azure storage', 'file storage']),
        }
```

#### Phase 2: AI-Enhanced Document Analysis

**File: `templates/prompts/document_analysis.txt`**

```
You are an expert in Microsoft 365 and Azure architecture. Analyze the following document content and identify:

1. **Components**: List all M365, Azure, and Power Platform components mentioned
2. **Data Flows**: Describe how data moves between components
3. **User Interactions**: Identify how users interact with the system
4. **Integration Points**: Note any external systems or APIs

## Document Content:
{document_text}

## Output Format:
Return a JSON object with this structure:
{
    "title": "Suggested diagram title",
    "components": ["Component1", "Component2", ...],
    "flows": [
        {"from": "Component1", "to": "Component2", "label": "description"},
        ...
    ],
    "clusters": [
        {"name": "Cluster Name", "components": ["Component1", "Component2"]}
    ]
}

Only include components from this list:
- User, M365 Copilot, Copilot Studio, Teams, SharePoint, Graph API
- Dataverse, Power Automate, Power Apps, Power BI, Power Pages
- Azure OpenAI, Azure AI Search, Azure AI Foundry
- Custom Connector, SQL Database, Blob Storage

Return ONLY the JSON, no explanations.
```

**Update: `src/m365_diagrams/ai_assistant.py`**

Add method:
```python
def analyze_document(self, document_text: str) -> dict:
    """Analyze document content and extract architecture information.

    Args:
        document_text: Extracted text from document.

    Returns:
        dict with components, flows, and clusters.
    """
    prompt_path = Path(__file__).parent.parent.parent / "templates" / "prompts" / "document_analysis.txt"
    system_prompt = prompt_path.read_text()

    # Truncate document if too long (keep first 8000 chars)
    if len(document_text) > 8000:
        document_text = document_text[:8000] + "\n\n[Document truncated...]"

    response = self.client.chat.completions.create(
        model=self.model,
        messages=[
            {"role": "system", "content": system_prompt.replace("{document_text}", document_text)},
            {"role": "user", "content": "Analyze this document and extract the architecture."}
        ],
        temperature=0.3,
        max_tokens=2000,
    )

    # Parse JSON response
    import json
    return json.loads(response.choices[0].message.content)
```

#### Phase 3: CLI Integration

**Update: `src/m365_diagrams/cli.py`**

Add new command:
```python
@app.command("from-doc")
def generate_from_document(
    file_path: str = typer.Argument(..., help="Path to Word (.docx) or PDF (.pdf) file"),
    output: str = typer.Option("./output", "-o", "--output", help="Output directory"),
    filename: Optional[str] = typer.Option(None, "-f", "--filename", help="Output filename"),
    format: str = typer.Option("png", "--format", help="Output format: png, ascii"),
    use_ai: bool = typer.Option(False, "--use-ai", help="Use AI for better analysis"),
    preview_only: bool = typer.Option(False, "--preview-only", help="Preview extracted content only"),
):
    """Generate a diagram from a Word or PDF document."""
    from .document_parser import DocumentParser
    from .generator import DiagramGenerator
    from .ai_assistant import AIAssistant

    # Parse document
    parser = DocumentParser()
    try:
        parsed = parser.parse(file_path)
    except Exception as e:
        console.print(f"[red]Failed to parse document:[/red] {e}")
        raise typer.Exit(code=1)

    if preview_only:
        console.print(Panel(parsed['text'][:2000] + "...", title="Document Preview"))
        components = parser.extract_components(parsed)
        console.print("\n[bold]Detected Components:[/bold]")
        for key, value in components.items():
            if value:
                console.print(f"  - {key.replace('has_', '').replace('_', ' ').title()}")
        return

    # Generate diagram
    if use_ai:
        assistant = AIAssistant()
        if not assistant.is_available():
            console.print("[yellow]AI not configured, falling back to keyword matching[/yellow]")
            components = parser.extract_components(parsed)
        else:
            console.print("[dim]Analyzing document with AI...[/dim]")
            analysis = assistant.analyze_document(parsed['text'])
            # Use AI analysis to generate diagram
            # ... (generate from analysis dict)
    else:
        components = parser.extract_components(parsed)

    generator = DiagramGenerator(output_dir=output)
    output_name = filename or Path(file_path).stem + "_diagram"

    # Generate based on extracted components
    # ... (implementation details)

    console.print(f"[green]Diagram generated from document[/green]")
```

#### Phase 4: Update Dependencies

**Update: `setup.py`**

```python
install_requires=[
    "diagrams>=0.24.4",
    "graphviz>=0.20.3",
    "typer>=0.9.0",
    "rich>=13.0.0",
    "openai>=1.0.0",
    "python-dotenv>=1.0.0",
    "pydantic>=2.0.0",
    "python-docx>=1.1.0",  # NEW: Word document parsing
    "pypdf>=4.0.0",        # NEW: PDF parsing
],
```

**Update: `requirements.txt`**

```
diagrams>=0.24.4
graphviz>=0.20.3
typer>=0.9.0
rich>=13.0.0
openai>=1.0.0
python-dotenv>=1.0.0
pydantic>=2.0.0
python-docx>=1.1.0
pypdf>=4.0.0
```

---

## Implementation Checklist

### Document Input Feature (COMPLETED)

- [x] Create `document_parser.py` module
  - [x] Word (.docx) parsing with python-docx
  - [x] PDF parsing with pypdf
  - [x] Text extraction and cleaning
  - [x] Component keyword detection

- [x] Create `document_analysis.txt` prompt template
  - [x] System prompt for AI analysis
  - [x] JSON output format specification

- [x] Update `ai_assistant.py`
  - [x] Add `analyze_document()` method
  - [x] Handle long documents (truncation/chunking)

- [x] Update `cli.py`
  - [x] Add `from-doc` command
  - [x] Support --use-ai flag
  - [x] Support --preview-only flag
  - [x] Error handling for unsupported files

- [x] Update `generator.py`
  - [x] Add method to generate from AI analysis dict
  - [x] Support custom flows/relationships from analysis

- [x] Update `ascii_renderer.py`
  - [x] Add `render_from_analysis()` method

- [x] Update dependencies
  - [x] Add python-docx to requirements.txt
  - [x] Add pypdf to requirements.txt
  - [x] Update setup.py

- [x] Testing
  - [x] Test with sample Word document
  - [x] Test preview mode
  - [x] Test PNG generation
  - [x] Test ASCII generation
  - [x] Test fallback to keyword matching

---

## Usage Examples

### After Implementation

```bash
# Basic document parsing (keyword-based)
m365-diagram from-doc ./architecture-spec.docx

# AI-enhanced analysis (requires API key)
m365-diagram from-doc ./design-document.pdf --use-ai

# Preview what was extracted
m365-diagram from-doc ./spec.docx --preview-only

# ASCII output for documentation
m365-diagram from-doc ./spec.pdf --format ascii -o ./docs/

# Custom output filename
m365-diagram from-doc ./spec.docx -f my_architecture -o ./diagrams/
```

### Sample Input Document Content

A document with content like:
```
Architecture Overview

The solution uses Microsoft 365 Copilot integrated with SharePoint
for document retrieval. Users interact through Microsoft Teams where
Copilot provides AI-assisted responses.

Data flows from SharePoint through the Microsoft Graph API to Copilot.
Azure OpenAI processes the queries and returns responses.

Power Automate handles automated workflows triggered by SharePoint
document uploads, storing metadata in Dataverse.
```

Would generate a diagram showing:
- User -> Teams -> M365 Copilot
- Copilot -> Graph API -> SharePoint
- Copilot -> Azure OpenAI
- SharePoint -> Power Automate -> Dataverse

---

## Configuration

### Environment Variables

```env
# For AI-enhanced document analysis
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4

# OR
OPENAI_API_KEY=your-key
```

### Running the CLI

```bash
# After installation
m365-diagram from-doc ./document.docx

# Or with Python module
python -m m365_diagrams from-doc ./document.docx
```

---

## Notes

- PDF table extraction is limited; complex tables may not parse correctly
- AI analysis provides better results but requires API configuration
- Long documents are truncated to avoid token limits
- The keyword-based fallback works without any API keys
