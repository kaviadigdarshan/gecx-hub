import os
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/downloads", tags=["downloads"])

LOCAL_ARTIFACTS_DIR = Path("/tmp/gecx-hub-artifacts")


async def save_artifact_locally(data: bytes, request_id: str, filename: str) -> str:
    """Save bytes to /tmp and return a local download URL."""
    dir_path = LOCAL_ARTIFACTS_DIR / request_id
    dir_path.mkdir(parents=True, exist_ok=True)
    file_path = dir_path / filename

    def _write():
        file_path.write_bytes(data)

    await asyncio.to_thread(_write)

    base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    return f"{base_url}/downloads/{request_id}/{filename}"


@router.get("/{request_id}/{filename}")
async def download_artifact(request_id: str, filename: str):
    file_path = LOCAL_ARTIFACTS_DIR / request_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found or expired")
    return FileResponse(
        path=str(file_path),
        media_type="application/zip",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
