import logging

from fastapi import APIRouter, Depends, HTTPException

from auth.dependencies import get_current_user_with_token
from models.auth import User
from models.project_context import ScaffoldContext
from services.gcs_service import get_gcs_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/context", tags=["Project Context"])


def _blob_name(project_id: str) -> str:
    return f"contexts/{project_id}/scaffold_context.json"


@router.get("/{project_id}", response_model=ScaffoldContext)
async def get_scaffold_context(
    project_id: str,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> ScaffoldContext:
    """
    Load the scaffold context for a project from GCS.
    Returns 404 when no context exists yet — the client treats 404 as
    "no context" rather than an error.
    """
    gcs = get_gcs_service()
    try:
        data = await gcs.download_bytes(_blob_name(project_id))
        return ScaffoldContext.model_validate_json(data)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No scaffold context for this project")
    except Exception as e:
        logger.warning(f"Failed to load context for {project_id}: {e}")
        raise HTTPException(status_code=404, detail="No scaffold context for this project")


@router.put("/{project_id}", response_model=dict)
async def save_scaffold_context(
    project_id: str,
    context: ScaffoldContext,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> dict:
    """Save (overwrite) the scaffold context to GCS."""
    gcs = get_gcs_service()
    try:
        await gcs.upload_bytes(
            context.model_dump_json(indent=2).encode("utf-8"),
            _blob_name(project_id),
            content_type="application/json",
        )
        return {"saved": True, "project_id": project_id}
    except Exception as e:
        logger.error(f"Failed to save context for {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save context")
