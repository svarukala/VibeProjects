"""Configuration loading and validation."""

import os
import re
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class SECConfig(BaseModel):
    """SEC API configuration."""
    user_agent: str = "SEC-Connector/1.0 (your-email@example.com)"
    rate_limit: int = 10
    base_url: str = "https://www.sec.gov"
    data_url: str = "https://data.sec.gov"


class AzureConfig(BaseModel):
    """Azure/Microsoft Graph configuration."""
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    connection_id: str = "pysecfilings"
    connection_name: str = "SEC EDGAR Filings"
    connection_description: str = "SEC EDGAR filings including 10-K, 10-Q, 8-K, and DEF 14A forms"


class FilingsConfig(BaseModel):
    """Filing types to process."""
    forms: list[str] = Field(default_factory=lambda: ["10-K", "10-Q", "8-K", "DEF 14A"])


class ChunkingConfig(BaseModel):
    """Content chunking configuration."""
    target_size: int = 4000
    max_size: int = 8000
    overlap: int = 200
    max_item_bytes: int = 4194304  # 4 MB


class ProcessingConfig(BaseModel):
    """Processing configuration."""
    concurrent_downloads: int = 5
    batch_size: int = 20
    ocr_images: bool = False  # Enable OCR for rotated-text images (requires easyocr or pytesseract)


class TestModeConfig(BaseModel):
    """Test mode limits."""
    max_filings: int = 2
    max_pages: int = 5


class PathsConfig(BaseModel):
    """File paths configuration."""
    downloads: str = "data/downloads"
    payloads: str = "data/payloads"
    database: str = "data/state.db"
    logs: str = "data/logs"


class AppConfig(BaseSettings):
    """Main application configuration."""
    sec: SECConfig = Field(default_factory=SECConfig)
    azure: AzureConfig = Field(default_factory=AzureConfig)
    filings: FilingsConfig = Field(default_factory=FilingsConfig)
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig)
    processing: ProcessingConfig = Field(default_factory=ProcessingConfig)
    test_mode: TestModeConfig = Field(default_factory=TestModeConfig)
    paths: PathsConfig = Field(default_factory=PathsConfig)

    class Config:
        env_prefix = ""
        extra = "ignore"


def expand_env_vars(value: Any) -> Any:
    """Recursively expand environment variables in config values."""
    if isinstance(value, str):
        pattern = r'\$\{([^}]+)\}'
        matches = re.findall(pattern, value)
        for match in matches:
            env_value = os.environ.get(match, "")
            value = value.replace(f"${{{match}}}", env_value)
        return value
    elif isinstance(value, dict):
        return {k: expand_env_vars(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [expand_env_vars(item) for item in value]
    return value


def load_config(config_path: Optional[Path] = None) -> AppConfig:
    """Load configuration from YAML file with environment variable expansion."""
    if config_path is None:
        config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"

    if not config_path.exists():
        config_path = Path("config/config.yaml")

    config_data = {}
    if config_path.exists():
        with open(config_path) as f:
            config_data = yaml.safe_load(f) or {}

    config_data = expand_env_vars(config_data)

    return AppConfig(**config_data)


def ensure_directories(config: AppConfig) -> None:
    """Create required directories if they don't exist."""
    for path_attr in ["downloads", "payloads", "database", "logs"]:
        path = Path(getattr(config.paths, path_attr))
        if path_attr == "database":
            path = path.parent
        path.mkdir(parents=True, exist_ok=True)
