"""Microsoft Graph API client for Copilot connector operations."""

import asyncio
import json
from pathlib import Path
from typing import Optional

import aiohttp
from msal import ConfidentialClientApplication

from .config import AppConfig
from .models import ContentChunk, GraphExternalItem
from .utils import get_logger, retry_with_backoff

logger = get_logger("graph_client")

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
GRAPH_BETA_URL = "https://graph.microsoft.com/beta"


class GraphClient:
    """Client for Microsoft Graph API operations."""

    def __init__(self, config: AppConfig):
        self.config = config
        self._token: Optional[str] = None
        self._token_expires: float = 0
        self._session: Optional[aiohttp.ClientSession] = None

        self._msal_app = ConfidentialClientApplication(
            client_id=config.azure.client_id,
            client_credential=config.azure.client_secret,
            authority=f"https://login.microsoftonline.com/{config.azure.tenant_id}",
        )

    async def __aenter__(self) -> "GraphClient":
        """Create aiohttp session."""
        self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Close aiohttp session."""
        if self._session:
            await self._session.close()

    async def _get_token(self) -> str:
        """Get or refresh access token."""
        import time

        if self._token and time.time() < self._token_expires - 60:
            return self._token

        result = self._msal_app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )

        if "access_token" in result:
            self._token = result["access_token"]
            self._token_expires = time.time() + result.get("expires_in", 3600)
            return self._token
        else:
            error = result.get("error_description", result.get("error", "Unknown error"))
            raise RuntimeError(f"Failed to acquire token: {error}")

    async def _request(
        self,
        method: str,
        url: str,
        json_data: Optional[dict] = None,
        use_beta: bool = False,
    ) -> dict:
        """Make an authenticated request to Graph API."""
        if not self._session:
            raise RuntimeError("Client not initialized. Use async with context manager.")

        token = await self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        base = GRAPH_BETA_URL if use_beta else GRAPH_BASE_URL
        full_url = f"{base}{url}"

        @retry_with_backoff(max_attempts=5, exceptions=(aiohttp.ClientError,))
        async def _do_request():
            async with self._session.request(
                method, full_url, headers=headers, json=json_data
            ) as response:
                if response.status == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limited (429), waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    raise aiohttp.ClientError("Rate limited")

                if response.status == 503:
                    logger.warning(f"Service unavailable (503), will retry after 5s")
                    await asyncio.sleep(5)
                    raise aiohttp.ClientError("Service unavailable")

                if response.status >= 400:
                    text = await response.text()
                    logger.error(f"Graph API error {response.status}: {text}")
                    response.raise_for_status()

                if response.status == 204:
                    return {}

                return await response.json()

        return await _do_request()

    async def create_connection(self) -> dict:
        """Create an external connection for the connector."""
        connection_id = self.config.azure.connection_id

        connection_data = {
            "id": connection_id,
            "name": self.config.azure.connection_name,
            "description": self.config.azure.connection_description,
        }

        logger.info(f"Creating connection: {connection_id}")

        try:
            result = await self._request(
                "POST",
                "/external/connections",
                json_data=connection_data,
            )
            logger.info(f"Connection created: {connection_id}")
            return result
        except aiohttp.ClientResponseError as e:
            if e.status == 409:
                logger.info(f"Connection already exists: {connection_id}")
                return await self.get_connection()
            raise

    async def get_connection(self) -> dict:
        """Get the external connection."""
        connection_id = self.config.azure.connection_id
        return await self._request("GET", f"/external/connections/{connection_id}")

    async def delete_connection(self) -> None:
        """Delete the external connection."""
        connection_id = self.config.azure.connection_id
        logger.info(f"Deleting connection: {connection_id}")
        await self._request("DELETE", f"/external/connections/{connection_id}")
        logger.info(f"Connection deleted: {connection_id}")

    async def register_schema(self, schema_path: Optional[Path] = None) -> dict:
        """Register the schema for the connection.

        Args:
            schema_path: Path to schema.json file

        Returns:
            Schema registration result
        """
        connection_id = self.config.azure.connection_id

        if schema_path is None:
            schema_path = Path(__file__).parent.parent.parent / "config" / "schema.json"

        with open(schema_path) as f:
            schema = json.load(f)

        logger.info(f"Registering schema for connection: {connection_id}")

        try:
            result = await self._request(
                "PATCH",
                f"/external/connections/{connection_id}/schema",
                json_data=schema,
                use_beta=True,
            )
            logger.info("Schema registration initiated (may take a few minutes)")
            return result
        except aiohttp.ClientResponseError as e:
            if e.status == 409:
                logger.info("Schema registration already in progress, waiting...")
                return {}
            raise

    async def get_schema_status(self) -> dict:
        """Get the schema registration status."""
        connection_id = self.config.azure.connection_id
        return await self._request(
            "GET",
            f"/external/connections/{connection_id}/schema",
        )

    async def wait_for_schema(self, timeout: int = 300) -> bool:
        """Wait for schema to be ready.

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            True if schema is ready, False if timeout
        """
        import time

        start = time.time()

        while time.time() - start < timeout:
            try:
                status = await self.get_schema_status()

                # Schema is ready if it has properties defined
                if status.get("properties"):
                    logger.info("Schema is ready")
                    return True

                # Check for explicit status field (beta API)
                state = status.get("status", "")
                if state == "ready":
                    logger.info("Schema is ready")
                    return True
                elif state == "failed":
                    logger.error(f"Schema registration failed: {status}")
                    return False

                logger.info(f"Schema provisioning in progress, waiting...")
                await asyncio.sleep(10)

            except aiohttp.ClientResponseError as e:
                if e.status == 404:
                    logger.info("Schema not found yet, waiting...")
                    await asyncio.sleep(10)
                else:
                    raise

        logger.error("Schema registration timeout")
        return False

    def _chunk_to_external_item(self, chunk: ContentChunk) -> GraphExternalItem:
        """Convert a ContentChunk to a GraphExternalItem."""
        filing = chunk.filing

        properties = {
            "Title": chunk.title,
            "Company": filing.company_name,
            "Ticker": filing.ticker,
            "Form": filing.form,
            "FilingDate": filing.filing_date.isoformat(),
            "Description": f"{filing.form} filing for {filing.company_name}",
            "Url": filing.sec_url,
            "CIK": filing.cik,
            "AccessionNumber": filing.accession_number,
            "Sequence": chunk.document.sequence,
            "Page": chunk.page_number,
        }

        content = {
            "type": "text",
            "value": chunk.content,
        }

        return GraphExternalItem(
            id=chunk.graph_item_id,
            properties=properties,
            content=content,
        )

    async def upload_item(self, chunk: ContentChunk) -> dict:
        """Upload a single external item.

        Args:
            chunk: Content chunk to upload

        Returns:
            Upload result
        """
        connection_id = self.config.azure.connection_id
        item = self._chunk_to_external_item(chunk)

        result = await self._request(
            "PUT",
            f"/external/connections/{connection_id}/items/{item.id}",
            json_data={
                "properties": item.properties,
                "content": item.content,
                "acl": item.acl,
            },
        )

        logger.debug(f"Uploaded item: {item.id}")
        return result

    async def upload_items_batch(
        self,
        chunks: list[ContentChunk],
    ) -> tuple[list[str], list[str]]:
        """Upload multiple items.

        Note: Graph API doesn't support true batch for external items,
        so we upload concurrently with rate limiting.

        Args:
            chunks: List of content chunks to upload

        Returns:
            Tuple of (successful_ids, failed_ids)
        """
        successful = []
        failed = []

        semaphore = asyncio.Semaphore(5)

        async def upload_one(chunk: ContentChunk) -> bool:
            async with semaphore:
                try:
                    await self.upload_item(chunk)
                    return True
                except Exception as e:
                    logger.error(f"Failed to upload {chunk.chunk_id}: {e}")
                    return False

        tasks = [upload_one(chunk) for chunk in chunks]
        results = await asyncio.gather(*tasks)

        for chunk, success in zip(chunks, results):
            if success:
                successful.append(chunk.chunk_id)
            else:
                failed.append(chunk.chunk_id)

        logger.info(f"Batch upload: {len(successful)} succeeded, {len(failed)} failed")
        return successful, failed

    async def delete_item(self, item_id: str) -> None:
        """Delete an external item."""
        connection_id = self.config.azure.connection_id
        await self._request(
            "DELETE",
            f"/external/connections/{connection_id}/items/{item_id}",
        )
        logger.debug(f"Deleted item: {item_id}")

    async def get_connection_quota(self) -> dict:
        """Get connection quota information."""
        connection_id = self.config.azure.connection_id
        return await self._request(
            "GET",
            f"/external/connections/{connection_id}/quota",
        )
