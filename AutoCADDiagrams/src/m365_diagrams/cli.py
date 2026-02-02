"""CLI entry point for M365 Diagrams generator."""

import sys
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

app = typer.Typer(
    name="m365-diagram",
    help="Generate M365 Copilot ecosystem architecture diagrams",
    add_completion=False,
)
console = Console()


@app.command("template")
def generate_from_template(
    template_name: str = typer.Argument(
        ..., help="Name of the template to generate"
    ),
    output: str = typer.Option(
        "./output", "-o", "--output", help="Output directory"
    ),
    filename: Optional[str] = typer.Option(
        None, "-f", "--filename", help="Custom filename (without extension)"
    ),
    format: str = typer.Option(
        "png", "--format", help="Output format: png, dot, drawio, ascii"
    ),
):
    """Generate a diagram from a pre-built template."""
    from .generator import DiagramGenerator
    from .ascii_renderer import ASCIIRenderer

    try:
        if format == "ascii":
            renderer = ASCIIRenderer()
            ascii_output = renderer.render_template(template_name)

            if filename:
                output_path = Path(output) / f"{filename}.txt"
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(ascii_output)
                console.print(f"[green]ASCII diagram saved to:[/green] {output_path}")
            else:
                console.print(ascii_output)
            return

        generator = DiagramGenerator(output_dir=output)
        output_path = generator.generate_from_template(
            template_name=template_name,
            output_format=format,
            filename=filename,
        )
        console.print(f"[green]Diagram generated:[/green] {output_path}")

    except ValueError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]Failed to generate diagram:[/red] {e}")
        raise typer.Exit(code=1)


@app.command("create")
def create_from_description(
    description: str = typer.Argument(
        ..., help="Text description of the diagram to create"
    ),
    output: str = typer.Option(
        "./output", "-o", "--output", help="Output directory"
    ),
    filename: str = typer.Option(
        "custom_diagram", "-f", "--filename", help="Output filename (without extension)"
    ),
    format: str = typer.Option(
        "png", "--format", help="Output format: png, dot, drawio, ascii"
    ),
):
    """Generate a diagram from a text description (manual parsing)."""
    from .generator import DiagramGenerator

    try:
        generator = DiagramGenerator(output_dir=output)
        output_path = generator.generate_from_description(
            description=description,
            output_format=format,
            filename=filename,
        )
        console.print(f"[green]Diagram generated:[/green] {output_path}")

    except Exception as e:
        console.print(f"[red]Failed to generate diagram:[/red] {e}")
        raise typer.Exit(code=1)


@app.command("ai")
def ai_generate(
    description: str = typer.Argument(
        ..., help="Natural language description of the diagram"
    ),
    output: str = typer.Option(
        "./output", "-o", "--output", help="Output directory"
    ),
    filename: str = typer.Option(
        "ai_generated", "-f", "--filename", help="Output filename (without extension)"
    ),
    format: str = typer.Option(
        "png", "--format", help="Output format: png, dot, drawio, ascii"
    ),
    explain: bool = typer.Option(
        False, "--explain", help="Get AI explanation of the architecture instead of generating"
    ),
):
    """Generate a diagram using AI (requires API key configuration)."""
    from .ai_assistant import AIAssistant

    assistant = AIAssistant()

    if not assistant.is_available():
        console.print(
            Panel(
                "[yellow]AI assistant not configured.[/yellow]\n\n"
                "Set environment variables:\n"
                "  • AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT\n"
                "  • OR OPENAI_API_KEY\n\n"
                "See .env.example for details.",
                title="Configuration Required",
            )
        )
        raise typer.Exit(code=1)

    console.print(f"[dim]{assistant.get_provider_info()}[/dim]")

    try:
        if explain:
            console.print("[dim]Generating architecture explanation...[/dim]")
            explanation = assistant.explain_diagram(description)
            console.print(Panel(explanation, title="Architecture Explanation"))
        else:
            console.print("[dim]Generating diagram with AI...[/dim]")
            output_path = assistant.generate_diagram(
                description=description,
                output_dir=output,
                filename=filename,
                output_format=format,
            )
            console.print(f"[green]Diagram generated:[/green] {output_path}")

    except Exception as e:
        console.print(f"[red]AI generation failed:[/red] {e}")
        raise typer.Exit(code=1)


@app.command("from-doc")
def generate_from_document(
    file_path: str = typer.Argument(
        ..., help="Path to Word (.docx) or PDF (.pdf) file"
    ),
    output: str = typer.Option(
        "./output", "-o", "--output", help="Output directory"
    ),
    filename: Optional[str] = typer.Option(
        None, "-f", "--filename", help="Output filename (without extension)"
    ),
    format: str = typer.Option(
        "png", "--format", help="Output format: png, svg, drawio, ascii"
    ),
    no_ai: bool = typer.Option(
        False, "--no-ai", help="Disable AI analysis, use keyword matching instead"
    ),
    preview_only: bool = typer.Option(
        False, "--preview-only", help="Preview extracted content without generating diagram"
    ),
):
    """Generate a diagram from a Word or PDF document (uses AI by default)."""
    from .document_parser import DocumentParser
    from .generator import DiagramGenerator
    from .ai_assistant import AIAssistant

    # Parse document
    parser = DocumentParser()

    console.print(f"[dim]Parsing document: {file_path}[/dim]")

    try:
        parsed = parser.parse(file_path)
    except FileNotFoundError as e:
        console.print(f"[red]File not found:[/red] {e}")
        raise typer.Exit(code=1)
    except ImportError as e:
        console.print(f"[red]Missing dependency:[/red] {e}")
        raise typer.Exit(code=1)
    except ValueError as e:
        console.print(f"[red]Invalid file:[/red] {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]Failed to parse document:[/red] {e}")
        raise typer.Exit(code=1)

    # Show preview if requested
    if preview_only:
        console.print(Panel(
            parser.get_summary(parsed, max_length=1500),
            title=f"Document Preview: {parsed.get('file_name', 'Unknown')}"
        ))

        # Show detected components
        components = parser.extract_components(parsed)
        detected = [
            key.replace('has_', '').replace('_', ' ').title()
            for key, value in components.items()
            if value
        ]

        if detected:
            console.print("\n[bold]Detected Components:[/bold]")
            for comp in detected:
                console.print(f"  * {comp}")
        else:
            console.print("\n[yellow]No M365 components detected in document.[/yellow]")

        # Show metadata
        metadata = parsed.get('metadata', {})
        if any(metadata.values()):
            console.print("\n[bold]Document Metadata:[/bold]")
            for key, value in metadata.items():
                if value:
                    console.print(f"  * {key}: {value}")

        return

    # Determine output filename
    output_name = filename or Path(file_path).stem + "_diagram"

    # Generate diagram
    generator = DiagramGenerator(output_dir=output)

    try:
        if no_ai:
            # Use keyword-based extraction (fallback mode)
            components = parser.extract_components(parsed)
            detected_count = sum(1 for v in components.values() if v)
            console.print(f"[dim]Using keyword matching: detected {detected_count} component types[/dim]")

            # Generate description from document title or first part of text
            title = parsed.get('metadata', {}).get('title') or parsed['text'][:200]

            output_path = generator.generate_from_description(
                description=title,
                output_format=format,
                filename=output_name,
            )
        else:
            # Use AI analysis (default)
            assistant = AIAssistant()
            if not assistant.is_available():
                console.print("[yellow]AI not configured. Set OPENAI_API_KEY or use --no-ai flag.[/yellow]")
                console.print("[dim]Falling back to keyword matching...[/dim]")
                components = parser.extract_components(parsed)
                output_path = generator.generate_from_description(
                    description=parsed['text'][:500],
                    output_format=format,
                    filename=output_name,
                )
            else:
                console.print("[dim]Analyzing document with AI...[/dim]")
                analysis = assistant.analyze_document(parsed['text'])

                console.print(f"[dim]Identified: {len(analysis.get('components', []))} components, "
                            f"{len(analysis.get('flows', []))} flows[/dim]")

                output_path = generator.generate_from_analysis(
                    analysis=analysis,
                    output_format=format,
                    filename=output_name,
                )

        console.print(f"[green]Diagram generated from document:[/green] {output_path}")

    except Exception as e:
        console.print(f"[red]Failed to generate diagram:[/red] {e}")
        raise typer.Exit(code=1)


@app.command("templates")
def list_templates(
    verbose: bool = typer.Option(
        False, "-v", "--verbose", help="Show detailed template information"
    ),
):
    """List all available diagram templates."""
    from .templates import AVAILABLE_TEMPLATES

    table = Table(title="Available Templates")
    table.add_column("Template Name", style="cyan")
    table.add_column("Description", style="white")

    if verbose:
        table.add_column("Module", style="dim")

    for name, info in AVAILABLE_TEMPLATES.items():
        if verbose:
            table.add_row(name, info["description"], info["module"])
        else:
            table.add_row(name, info["description"])

    console.print(table)
    console.print("\n[dim]Use: m365-diagram template <name> -o ./output/[/dim]")


@app.command("ascii")
def ascii_preview(
    template_name: str = typer.Argument(
        ..., help="Template name to preview as ASCII"
    ),
):
    """Preview a template as ASCII art (for terminals/documentation)."""
    from .ascii_renderer import ASCIIRenderer

    renderer = ASCIIRenderer()
    output = renderer.render_template(template_name)
    console.print(output)


@app.command("info")
def show_info():
    """Show information about the M365 Diagram Generator."""
    from . import __version__
    from .ai_assistant import AIAssistant

    assistant = AIAssistant()

    # Check document parsing support
    from .document_parser import DocumentParser
    parser = DocumentParser()
    doc_formats = parser.get_supported_formats()
    doc_status = ", ".join(doc_formats) if doc_formats else "Install python-docx and pypdf"

    console.print(
        Panel(
            f"[bold]M365 Copilot Ecosystem Diagram Generator[/bold]\n"
            f"Version: {__version__}\n\n"
            f"[bold]Features:[/bold]\n"
            f"  * Generate architecture diagrams from templates\n"
            f"  * Create diagrams from text descriptions\n"
            f"  * Generate from Word/PDF documents\n"
            f"  * AI-powered diagram generation (with API key)\n"
            f"  * Multiple output formats: PNG, DOT, Draw.io, ASCII\n\n"
            f"[bold]AI Status:[/bold] {assistant.get_provider_info()}\n"
            f"[bold]Document Support:[/bold] {doc_status}\n\n"
            f"[bold]Quick Start:[/bold]\n"
            f"  m365-diagram templates          # List templates\n"
            f"  m365-diagram template copilot_sharepoint\n"
            f"  m365-diagram from-doc spec.docx # From document\n"
            f"  m365-diagram create \"User queries Copilot...\"\n"
            f"  m365-diagram ai \"Describe your architecture...\"",
            title="M365 Diagram Generator",
        )
    )


def main():
    """Main entry point."""
    app()


if __name__ == "__main__":
    main()
