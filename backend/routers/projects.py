"""Projects router: list GCP projects and CES apps accessible to the user."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user_with_token
from config import get_settings
from models.auth import User
from models.ces import AppListResponse, CESApp, GCPProject, ProjectListResponse
from services import ces_service, resource_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> ProjectListResponse:
    """Return all ACTIVE GCP projects visible to the authenticated user."""
    _, access_token = auth
    logger.info("GET /projects for user=%s", auth[0].id)
    projects = await resource_manager.list_projects(access_token)
    return ProjectListResponse(projects=[GCPProject(**p) for p in projects])


@router.get("/{project_id}/apps", response_model=AppListResponse)
async def list_apps(
    project_id: str,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> AppListResponse:
    """Return CES Agent Studio apps in the given project."""
    _, access_token = auth
    settings = get_settings()
    logger.info("GET /projects/%s/apps for user=%s", project_id, auth[0].id)

    try:
        apps = await ces_service.list_apps(project_id, settings.gcp_location, access_token)
    except Exception as exc:
        logger.error("Failed to list apps for project=%s: %s", project_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach CES API",
        ) from exc

    warning: str | None = None
    if not apps:
        warning = f"No CES apps found in project {project_id} ({settings.gcp_location})"

    return AppListResponse(
        apps=[CESApp(**a) for a in apps],
        warning=warning,
    )
