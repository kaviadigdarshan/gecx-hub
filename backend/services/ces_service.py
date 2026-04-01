"""Client wrapper for the CES Agent Studio REST API (ces.googleapis.com)."""

import logging
from functools import lru_cache
from typing import Any

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

CES_BASE_URL = "https://ces.googleapis.com"


class CESService:
    def _headers(self, access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def _app_path(self, project_id: str, location: str, app_id: str) -> str:
        return f"projects/{project_id}/locations/{location}/apps/{app_id}"

    async def list_apps(
        self, project_id: str, location: str, access_token: str
    ) -> list[dict[str, Any]]:
        """List CES Agent Studio apps in a project/location."""
        url = f"{CES_BASE_URL}/v1/projects/{project_id}/locations/{location}/apps"
        logger.info("Listing CES apps for project=%s location=%s", project_id, location)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=self._headers(access_token))
        if resp.status_code == 403:
            logger.warning("User lacks CES access to project %s", project_id)
            return []
        if resp.status_code == 404:
            logger.info("No CES apps found for project=%s location=%s", project_id, location)
            return []
        resp.raise_for_status()
        raw: list[dict[str, Any]] = resp.json().get("apps", [])
        return [
            {
                "name": app["name"],
                "displayName": app.get("displayName", app["name"]),
                "state": app.get("state", "STATE_UNSPECIFIED"),
            }
            for app in raw
        ]

    async def create_guardrail(
        self,
        project_id: str,
        location: str,
        app_id: str,
        guardrail_body: dict,
        access_token: str,
    ) -> dict[str, Any]:
        """Create a single guardrail resource on a CES app."""
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/guardrails"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url, headers=self._headers(access_token), json=guardrail_body
            )
        if not resp.is_success:
            error_detail = resp.json().get("error", {}).get("message", resp.text)
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"CES API error: {error_detail}",
            )
        return resp.json()

    async def create_version(
        self,
        project_id: str,
        location: str,
        app_id: str,
        display_name: str,
        access_token: str,
    ) -> dict[str, Any]:
        """Create a version snapshot of the app before applying changes."""
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/versions"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers=self._headers(access_token),
                json={"displayName": display_name},
            )
        if not resp.is_success:
            logger.warning("Version creation failed: %s", resp.text)
            return {}
        return resp.json()

    async def list_guardrails(
        self, project_id: str, location: str, app_id: str, access_token: str
    ) -> list[dict[str, Any]]:
        """List existing guardrails on a CES app."""
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/guardrails"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=self._headers(access_token))
        if not resp.is_success:
            return []
        return resp.json().get("guardrails", [])

    async def list_agents(
        self, project_id: str, location: str, app_id: str, access_token: str
    ) -> list[dict[str, Any]]:
        """List agents in a CES app.

        GET /v1/projects/{project_id}/locations/{location}/apps/{app_id}/agents
        Returns trimmed dicts: { name, displayName, instruction (first 100 chars) }.
        On any error: returns [].
        """
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/agents"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=self._headers(access_token))
        if not resp.is_success:
            logger.warning("list_agents failed: %s %s", resp.status_code, resp.text[:200])
            return []
        return [
            {
                "name": a["name"],
                "displayName": a.get("displayName", a["name"]),
                "instruction": a.get("instruction", "")[:100],
            }
            for a in resp.json().get("agents", [])
        ]

    async def get_agent(
        self,
        project_id: str,
        location: str,
        app_id: str,
        agent_id: str,
        access_token: str,
    ) -> dict[str, Any]:
        """Fetch a single agent resource, including its full instruction field.

        GET /v1/projects/{project_id}/locations/{location}/apps/{app_id}/agents/{agent_id}
        Raises HTTPException 404 if the agent does not exist.
        """
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/agents/{agent_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=self._headers(access_token))
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found in app '{app_id}'")
        resp.raise_for_status()
        return resp.json()

    async def update_agent_instruction(
        self,
        project_id: str,
        location: str,
        app_id: str,
        agent_id: str,
        instruction: str,
        access_token: str,
    ) -> dict[str, Any]:
        """Patch the instruction field of a CES agent.

        PATCH /v1/projects/{project_id}/locations/{location}/apps/{app_id}/agents/{agent_id}
        Uses updateMask=instruction to limit the patch to that field only.
        Raises HTTPException with the CES error message on failure.
        """
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/agents/{agent_id}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(
                url,
                headers=self._headers(access_token),
                params={"updateMask": "instruction"},
                json={"instruction": instruction},
            )
        if not resp.is_success:
            error_detail = resp.json().get("error", {}).get("message", resp.text)
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"CES API error: {error_detail}",
            )
        return resp.json()

    async def import_app(
        self,
        project_id: str,
        location: str,
        zip_bytes: bytes,
        access_token: str,
    ) -> dict[str, Any]:
        """POST /v1/projects/{project_id}/locations/{location}/apps:importApp

        Body format:
        {
          "appSnapshot": {
            "agentEngineSnapshot": "<base64-encoded ZIP bytes>"
          }
        }

        Returns the created App resource dict including name and displayName.
        On error: raise HTTPException with CES error message.
        Note: this is a long-running operation — response may be an Operation resource.
        For simplicity, poll for up to 30 seconds. If still running, return operation ID
        with a "pending" flag for the user to check in the console.
        """
        import base64

        url = f"{CES_BASE_URL}/v1/projects/{project_id}/locations/{location}/apps:importApp"
        encoded = base64.b64encode(zip_bytes).decode("utf-8")
        body = {"appSnapshot": {"agentEngineSnapshot": encoded}}

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers(access_token), json=body)

        if not resp.is_success:
            error_detail = resp.json().get("error", {}).get("message", resp.text)
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"CES import error: {error_detail}",
            )

        result = resp.json()

        # If it's a long-running operation (name starts with "operations/")
        if "name" in result and "operations" in result.get("name", ""):
            return {
                "pending": True,
                "operation_name": result["name"],
                "message": "Import started. Check the CES console for completion status.",
                "console_url": f"https://ces.cloud.google.com/projects/{project_id}",
            }

        return result

    async def list_tools(
        self, project_id: str, location: str, app_id: str, access_token: str
    ) -> list[dict[str, Any]]:
        """List tools available in a CES app.

        GET /v1/projects/{project_id}/locations/{location}/apps/{app_id}/tools
        Returns trimmed dicts: { name, displayName, description }.
        On any error: returns [].
        """
        url = f"{CES_BASE_URL}/v1/{self._app_path(project_id, location, app_id)}/tools"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=self._headers(access_token))
        if not resp.is_success:
            logger.warning("list_tools failed: %s %s", resp.status_code, resp.text[:200])
            return []
        return [
            {
                "name": t["name"],
                "displayName": t.get("displayName", t["name"]),
                "description": t.get("description", ""),
            }
            for t in resp.json().get("tools", [])
        ]


@lru_cache(maxsize=1)
def get_ces_service() -> CESService:
    return CESService()


# ── Module-level shim kept for backward compatibility with routers/projects.py ─

async def list_apps(
    project_id: str, location: str, access_token: str
) -> list[dict[str, Any]]:
    return await get_ces_service().list_apps(project_id, location, access_token)
