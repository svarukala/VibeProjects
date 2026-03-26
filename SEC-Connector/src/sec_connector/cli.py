"""Click-based CLI for SEC Connector."""

import asyncio
import re
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from .config import load_config, ensure_directories
from .pipeline import IngestionPipeline
from .utils import setup_logging

console = Console()


def run_async(coro):
    """Run an async coroutine."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    return asyncio.run(coro)


def sanitize_connection_id(name: str) -> str:
    """Sanitize connection ID to meet Graph API requirements.

    Graph Connector IDs must be alphanumeric only (no hyphens, spaces, or special chars).

    Args:
        name: User-provided connection name

    Returns:
        Sanitized alphanumeric connection ID
    """
    # Remove all non-alphanumeric characters
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', name)

    # Ensure it's not empty
    if not sanitized:
        sanitized = "secfilings"

    # Ensure it starts with a letter (Graph API requirement)
    if sanitized[0].isdigit():
        sanitized = "conn" + sanitized

    # Lowercase for consistency
    return sanitized.lower()


def prompt_for_connection_id() -> tuple[str, str]:
    """Prompt user for connection name and derive the sanitized ID.

    Returns:
        Tuple of (connection_id, connection_name).
    """
    console.print("\n[bold cyan]Graph Connector Configuration[/]")
    console.print("The connection name identifies your connector in Microsoft 365.")
    console.print("[dim]The connection ID (alphanumeric) is derived automatically.[/]\n")

    while True:
        name = click.prompt("Enter a name for your connector", default="SEC Filings")
        sanitized = sanitize_connection_id(name)

        console.print(f"\n  Connection name: [yellow]{name}[/]")
        console.print(f"  Connection ID:   [green]{sanitized}[/]\n")

        if click.confirm("Use this connection?", default=True):
            return sanitized, name
        console.print()


@click.group()
@click.option("--config", "-c", type=click.Path(exists=True), help="Path to config file")
@click.option("--connection-id", "-n", help="Connection ID for Graph connector (alphanumeric only)")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
@click.pass_context
def main(ctx, config: Optional[str], connection_id: Optional[str], verbose: bool):
    """SEC Copilot Connector - Import SEC EDGAR filings into Microsoft 365."""
    ctx.ensure_object(dict)

    config_path = Path(config) if config else None
    ctx.obj["config"] = load_config(config_path)
    ctx.obj["verbose"] = verbose
    ctx.obj["connection_id_override"] = connection_id

    ensure_directories(ctx.obj["config"])
    log_dir = Path(ctx.obj["config"].paths.logs)
    setup_logging(log_dir, verbose)


def apply_connection_config(config, connection_id: Optional[str] = None, connection_name: Optional[str] = None) -> None:
    """Apply connection ID and name to the config object.

    Args:
        config: AppConfig to update
        connection_id: Sanitized connection ID
        connection_name: Human-readable display name for the connection
    """
    if connection_id:
        config.azure.connection_id = connection_id
    if connection_name:
        config.azure.connection_name = connection_name


@main.command()
@click.option("--connection-id", "-n", help="Connection ID for Graph connector")
@click.option("--connection-name", help="Display name for the connector in Microsoft 365")
@click.pass_context
def setup(ctx, connection_id: Optional[str], connection_name: Optional[str]):
    """Set up the Graph connector and schema."""
    config = ctx.obj["config"]

    if not config.azure.client_id or not config.azure.tenant_id:
        console.print("[bold red]Error: Azure credentials not configured![/]")
        console.print("Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET environment variables.")
        raise SystemExit(1)

    # Get connection ID and name from option, parent option, or prompt
    if connection_id:
        conn_id = sanitize_connection_id(connection_id)
        conn_name = connection_name or connection_id
        if conn_id != connection_id:
            console.print(f"[yellow]Connection ID sanitized: {connection_id} -> {conn_id}[/]")
    elif ctx.obj.get("connection_id_override"):
        raw = ctx.obj["connection_id_override"]
        conn_id = sanitize_connection_id(raw)
        conn_name = connection_name or raw
    else:
        conn_id, conn_name = prompt_for_connection_id()
        # CLI --connection-name overrides the prompted name
        if connection_name:
            conn_name = connection_name

    apply_connection_config(config, conn_id, conn_name)
    console.print(f"[bold]Connection name: [yellow]{config.azure.connection_name}[/][/]")
    console.print(f"[bold]Connection ID:   [green]{config.azure.connection_id}[/][/]")

    pipeline = IngestionPipeline(config)

    try:
        run_async(pipeline.setup())
    except Exception as e:
        console.print(f"[bold red]Setup failed: {e}[/]")
        raise SystemExit(1)


@main.command()
@click.option("--tickers", "-t", required=True, help="Comma-separated list of ticker symbols")
@click.option("--connection-id", "-n", help="Connection ID for Graph connector")
@click.option("--connection-name", help="Display name for the connector in Microsoft 365")
@click.option("--test", is_flag=True, help="Run in test mode (limited filings)")
@click.option("--max-filings", type=int, help="Maximum filings per ticker")
@click.option("--max-pages", type=int, help="Maximum pages per filing")
@click.option("--save-payloads", is_flag=True, default=False, help="Save upload payloads as JSON files to data/payloads/")
@click.pass_context
def ingest(ctx, tickers: str, connection_id: Optional[str], connection_name: Optional[str], test: bool, max_filings: Optional[int], max_pages: Optional[int], save_payloads: bool):
    """Ingest SEC filings for specified tickers."""
    config = ctx.obj["config"]

    # Apply connection overrides
    if connection_id:
        conn_id = sanitize_connection_id(connection_id)
        if conn_id != connection_id:
            console.print(f"[yellow]Connection ID sanitized: {connection_id} -> {conn_id}[/]")
        apply_connection_config(config, conn_id, connection_name or connection_id)
    elif ctx.obj.get("connection_id_override"):
        raw = ctx.obj["connection_id_override"]
        apply_connection_config(config, sanitize_connection_id(raw), connection_name or raw)
    elif connection_name:
        apply_connection_config(config, connection_name=connection_name)

    ticker_list = [t.strip().upper() for t in tickers.split(",")]

    if not ticker_list:
        console.print("[bold red]Error: No tickers specified[/]")
        raise SystemExit(1)

    console.print(f"[bold]SEC Connector - Ingesting filings for: {', '.join(ticker_list)}[/]")
    console.print(f"[dim]Connection: {config.azure.connection_name} ({config.azure.connection_id})[/]")

    if test:
        console.print("[yellow]Running in TEST MODE[/]")

    pipeline = IngestionPipeline(config, test_mode=test, save_payloads=save_payloads)

    try:
        stats = run_async(pipeline.ingest(
            tickers=ticker_list,
            max_filings=max_filings,
            max_pages=max_pages,
        ))

        _print_stats(stats)

    except Exception as e:
        console.print(f"[bold red]Ingestion failed: {e}[/]")
        raise SystemExit(1)


@main.command()
@click.option("--connection-id", "-n", help="Connection ID for Graph connector")
@click.option("--connection-name", help="Display name for the connector in Microsoft 365")
@click.option("--save-payloads", is_flag=True, default=False, help="Save upload payloads as JSON files to data/payloads/")
@click.pass_context
def resume(ctx, connection_id: Optional[str], connection_name: Optional[str], save_payloads: bool):
    """Resume interrupted processing."""
    config = ctx.obj["config"]

    # Apply connection overrides
    if connection_id:
        apply_connection_config(config, sanitize_connection_id(connection_id), connection_name or connection_id)
    elif ctx.obj.get("connection_id_override"):
        raw = ctx.obj["connection_id_override"]
        apply_connection_config(config, sanitize_connection_id(raw), connection_name or raw)
    elif connection_name:
        apply_connection_config(config, connection_name=connection_name)

    console.print("[bold]Resuming interrupted processing...[/]")
    console.print(f"[dim]Connection: {config.azure.connection_name} ({config.azure.connection_id})[/]")

    pipeline = IngestionPipeline(config, save_payloads=save_payloads)

    try:
        stats = run_async(pipeline.resume())

        console.print("\n[bold]Resume Results:[/]")
        console.print(f"  Filings resumed: {stats['filings_resumed']}")
        console.print(f"  Chunks uploaded: {stats['chunks_uploaded']}")
        console.print(f"  Errors: {stats['errors']}")

    except Exception as e:
        console.print(f"[bold red]Resume failed: {e}[/]")
        raise SystemExit(1)


@main.command()
@click.option("--connection-id", "-n", help="Connection ID for Graph connector")
@click.pass_context
def status(ctx, connection_id: Optional[str]):
    """Show processing status."""
    config = ctx.obj["config"]

    # Apply connection overrides
    if connection_id:
        apply_connection_config(config, sanitize_connection_id(connection_id))
    elif ctx.obj.get("connection_id_override"):
        apply_connection_config(config, sanitize_connection_id(ctx.obj["connection_id_override"]))

    console.print(f"[dim]Connection: {config.azure.connection_name} ({config.azure.connection_id})[/]")

    pipeline = IngestionPipeline(config)

    try:
        stats = run_async(pipeline.status())

        console.print("\n[bold]Processing Status:[/]")

        table = Table(title="Filings")
        table.add_column("State", style="cyan")
        table.add_column("Count", justify="right")

        for state, count in stats.get("filings", {}).items():
            table.add_row(state, str(count))

        table.add_row("[bold]Total[/]", f"[bold]{stats.get('total_filings', 0)}[/]")
        console.print(table)

        table = Table(title="Chunks")
        table.add_column("State", style="cyan")
        table.add_column("Count", justify="right")

        for state, count in stats.get("chunks", {}).items():
            table.add_row(state, str(count))

        table.add_row("[bold]Total[/]", f"[bold]{stats.get('total_chunks', 0)}[/]")
        console.print(table)

    except Exception as e:
        console.print(f"[bold red]Status check failed: {e}[/]")
        raise SystemExit(1)


@main.command()
@click.option("--connection-id", "-n", help="Connection ID for Graph connector")
@click.confirmation_option(prompt="Are you sure you want to reset the connector?")
@click.pass_context
def reset(ctx, connection_id: Optional[str]):
    """Reset the connector (delete connection and state)."""
    config = ctx.obj["config"]

    # Apply connection overrides
    if connection_id:
        apply_connection_config(config, sanitize_connection_id(connection_id))
    elif ctx.obj.get("connection_id_override"):
        apply_connection_config(config, sanitize_connection_id(ctx.obj["connection_id_override"]))

    console.print(f"[dim]Connection: {config.azure.connection_name} ({config.azure.connection_id})[/]")

    pipeline = IngestionPipeline(config)

    try:
        run_async(pipeline.reset())
    except Exception as e:
        console.print(f"[bold red]Reset failed: {e}[/]")
        raise SystemExit(1)


def _print_stats(stats: dict) -> None:
    """Print ingestion statistics."""
    console.print("\n[bold]Ingestion Complete![/]")

    table = Table(title="Statistics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right")

    table.add_row("Tickers processed", str(stats.get("tickers_processed", 0)))
    table.add_row("Filings discovered", str(stats.get("filings_discovered", 0)))
    table.add_row("Filings downloaded", str(stats.get("filings_downloaded", 0)))
    table.add_row("Filings parsed", str(stats.get("filings_parsed", 0)))
    table.add_row("Chunks created", str(stats.get("chunks_created", 0)))
    table.add_row("Chunks uploaded", str(stats.get("chunks_uploaded", 0)))
    table.add_row("Errors", str(stats.get("errors", 0)))

    console.print(table)

    if stats.get("errors", 0) > 0:
        console.print("\n[yellow]Some errors occurred. Check logs for details.[/]")
    else:
        console.print("\n[green]All items processed successfully![/]")


if __name__ == "__main__":
    main()
