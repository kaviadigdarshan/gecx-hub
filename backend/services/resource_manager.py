"""GCP Resource Manager client: list projects accessible to the authenticated user."""

import asyncio
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_RESOURCE_MANAGER_URL = "https://cloudresourcemanager.googleapis.com/v3/projects"
_CACHE_TTL_SECONDS = 300  # 5 minutes

# asyncio-safe in-process cache: token -> (expiry_timestamp, projects_list)
_project_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_cache_lock = asyncio.Lock()


async def list_projects(access_token: str) -> list[dict[str, Any]]:
    """Return ACTIVE GCP projects visible to the user.

    Results are cached per access_token for 5 minutes to avoid hammering
    the Resource Manager API on every project-selector render.
    """
    async with _cache_lock:
        cached = _project_cache.get(access_token)
        if cached and time.monotonic() < cached[0]:
            logger.debug("Returning cached projects list")
            return cached[1]

    logger.info("Fetching GCP projects from Resource Manager API v3")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                _RESOURCE_MANAGER_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                params={"pageSize": 100},
            )
    except httpx.RequestError as exc:
        logger.error("Resource Manager request failed: %s", exc)
        return []

    if response.status_code == 403:
        logger.warning("User lacks permission to list projects (403)")
        return []

    if response.status_code != 200:
        logger.error("Unexpected status from Resource Manager: %s", response.status_code)
        return []

    raw_projects: list[dict[str, Any]] = response.json().get("projects", [])
    projects = [
        {
            "project_id": p["projectId"],
            "display_name": p.get("displayName") or p["projectId"],
            "state": p.get("state", "ACTIVE"),
            "project_number": p.get("projectNumber", ""),
        }
        for p in raw_projects
        if p.get("state") == "ACTIVE"
    ]

    logger.info("Found %d active projects", len(projects))
    expiry = time.monotonic() + _CACHE_TTL_SECONDS
    async with _cache_lock:
        _project_cache[access_token] = (expiry, projects)

    return projects
