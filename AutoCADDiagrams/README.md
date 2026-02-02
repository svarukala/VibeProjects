# M365 Copilot Ecosystem Diagram Generator

A Python utility to generate architecture diagrams, data flow diagrams, and ASCII diagrams for Microsoft 365 Copilot ecosystem scenarios.

## Features

- **Pre-built Templates**: Common M365 Copilot architecture patterns
- **Manual Creation**: Generate diagrams from text descriptions
- **AI-Assisted**: Natural language to diagram with LLM integration
- **Multiple Formats**: PNG, DOT, Draw.io, ASCII output

## Installation

### Prerequisites

- Python 3.9+
- GraphViz (required for diagram rendering)

**Install GraphViz:**

```bash
# Windows (with Chocolatey)
choco install graphviz

# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt install graphviz
```

### Install Package

```bash
# Clone and install
cd AutoCADDiagrams
pip install -e .

# Or install dependencies directly
pip install -r requirements.txt
```

## Usage

### List Available Templates

```bash
m365-diagram templates
```

### Generate from Template

```bash
# Basic usage
m365-diagram template copilot_sharepoint

# With custom output directory
m365-diagram template copilot_sharepoint -o ./my-diagrams/

# With custom filename
m365-diagram template azure_foundry_rag -o ./output/ -f my_rag_diagram
```

### Generate from Description

```bash
# Create diagram from text description
m365-diagram create "User queries Copilot which retrieves data from SharePoint and Dataverse"

# ASCII output for documentation
m365-diagram create "Power Automate triggered by SharePoint" --format ascii
```

### AI-Assisted Generation

Requires API configuration (see Configuration section).

```bash
# Generate with AI
m365-diagram ai "I need a diagram showing how Power Automate triggers when a file is uploaded to SharePoint, processes it with Azure AI, and stores results in Dataverse"

# Get architecture explanation
m365-diagram ai "Explain RAG pattern with Copilot" --explain
```

### ASCII Preview

```bash
# Quick ASCII preview of a template
m365-diagram ascii copilot_sharepoint
```

## Available Templates

| Template | Description |
|----------|-------------|
| `copilot_sharepoint` | Copilot querying SharePoint data |
| `copilot_studio_agent` | Custom Copilot Studio agent with topics and actions |
| `power_automate_flow` | Automated workflow with Power Automate |
| `azure_foundry_rag` | RAG pattern with Azure AI Foundry |
| `power_bi_pipeline` | Data analytics flow with Power BI |
| `full_ecosystem` | Complete M365 Copilot architecture |

## Configuration

### AI Integration (Optional)

Create a `.env` file based on `.env.example`:

**For Azure OpenAI:**
```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4
```

**For OpenAI:**
```env
OPENAI_API_KEY=your-key
```

## Output Formats

- **PNG** (default): High-quality image
- **DOT**: GraphViz intermediate format
- **Draw.io**: Editable XML format (requires graphviz2drawio)
- **ASCII**: Text-based diagram for documentation/chat

## Project Structure

```
AutoCADDiagrams/
├── src/
│   └── m365_diagrams/
│       ├── cli.py              # CLI entry point
│       ├── generator.py        # Core diagram generation
│       ├── ai_assistant.py     # LLM integration
│       ├── ascii_renderer.py   # ASCII diagram generation
│       ├── icons/              # Custom M365 icon definitions
│       └── templates/          # Pre-built diagram templates
├── templates/
│   └── prompts/               # LLM system prompts
├── output/                    # Generated diagrams
├── requirements.txt
└── setup.py
```

## Programmatic Usage

```python
from m365_diagrams import DiagramGenerator, AIAssistant, ASCIIRenderer

# Generate from template
generator = DiagramGenerator(output_dir="./output")
path = generator.generate_from_template("copilot_sharepoint")

# Generate from description
path = generator.generate_from_description(
    "User queries Copilot for SharePoint documents",
    filename="my_diagram"
)

# AI generation (requires API config)
assistant = AIAssistant()
if assistant.is_available():
    path = assistant.generate_diagram("Describe your architecture...")

# ASCII output
renderer = ASCIIRenderer()
ascii_art = renderer.render_template("copilot_sharepoint")
print(ascii_art)
```

## License

MIT License
