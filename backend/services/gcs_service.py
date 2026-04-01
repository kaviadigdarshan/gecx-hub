"""Google Cloud Storage helpers: upload, download, and signed URL generation."""

import asyncio
import datetime
import os
from functools import lru_cache

from google.cloud import storage

from config import get_settings


class GCSService:
    def __init__(self) -> None:
        settings = get_settings()
        self.client = storage.Client()
        self.bucket_name = settings.gcs_bucket_name
        self.expiry_minutes = settings.gcs_signed_url_expiry_minutes

    async def upload_bytes(
        self,
        data: bytes,
        blob_name: str,
        content_type: str = "application/zip",
    ) -> str:
        """Upload raw bytes to GCS, overwriting any existing blob. Returns blob_name."""

        def _upload() -> None:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(blob_name)
            blob.upload_from_string(data, content_type=content_type)

        await asyncio.to_thread(_upload)
        return blob_name

    async def download_bytes(self, blob_name: str) -> bytes:
        """Download a blob's raw bytes. Raises FileNotFoundError if blob does not exist."""

        def _download() -> bytes:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(blob_name)
            if not blob.exists():
                raise FileNotFoundError(f"Blob {blob_name} not found")
            return blob.download_as_bytes()

        return await asyncio.to_thread(_download)

    async def generate_signed_url(self, blob_name: str) -> str:
        def _make_public():
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(blob_name)
            blob.make_public()
            return blob.public_url
        return await asyncio.to_thread(_make_public)

    # async def generate_signed_url(
    #     self, blob_name: str, expiry_minutes: int | None = None
    # ) -> str:
    #     """Return a time-limited signed URL for downloading a blob."""
    #     expiry = expiry_minutes or self.expiry_minutes

    #     def _sign() -> str:
    #         bucket = self.client.bucket(self.bucket_name)
    #         blob = bucket.blob(blob_name)
    #         return blob.generate_signed_url(
    #             expiration=datetime.timedelta(minutes=expiry),
    #             method="GET",
    #             version="v4",
    #         )

    #     return await asyncio.to_thread(_sign)

    async def upload_and_get_url(
        self,
        data: bytes,
        blob_name: str,
        content_type: str = "application/zip",
    ) -> str:
        """Upload artifact and return a download URL.

        In local dev (USE_LOCAL_STORAGE=true or GCS unavailable), saves to /tmp
        and returns a localhost download URL. In production, uploads to GCS and
        returns a signed URL via IAM SignBlob.
        """
        use_local = os.getenv("USE_LOCAL_STORAGE", "false").lower() == "true"

        if use_local:
            from routers.downloads import save_artifact_locally
            # blob_name format: "guardrails/{request_id}/{filename}"
            parts = blob_name.split("/")
            request_id = parts[1] if len(parts) >= 3 else "unknown"
            filename = parts[-1]
            return await save_artifact_locally(data, request_id, filename)

        # Production path: upload to GCS, return signed URL
        await self.upload_bytes(data, blob_name, content_type)
        return await self.generate_signed_url(blob_name)


@lru_cache(maxsize=1)
def get_gcs_service() -> GCSService:
    return GCSService()
