"""End-to-end tests for the scaffolder pipeline.

These tests call POST /accelerators/scaffolder/generate through the full
FastAPI stack with two external dependencies mocked:
  - services.architecture_service.get_gemini_service  (avoids Vertex AI calls)
  - routers.accelerators.scaffolder.get_gcs_service   (captures ZIP bytes in-memory)

Auth is bypassed via a dependency override on get_current_user_with_token.
Local-storage and artifact-dir fixtures are provided by conftest.py (autouse).
"""

import io
import json
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from auth.dependencies import get_current_user_with_token
from main import app
from models.auth import User

# ─────────────────────────────────────────────────────────────────────────────
# Module-level helpers
# ─────────────────────────────────────────────────────────────────────────────

_MOCK_USER = User(id="e2e-001", email="e2e@gecx.io", name="E2E Test")


async def _override_auth() -> tuple[User, str]:
    return _MOCK_USER, "fake-google-access-token"


def _make_scaffold_body(capabilities: list[str]) -> dict:
    """Build a minimal but valid AppScaffoldRequest payload."""
    return {
        "use_case": {
            "business_domain": "retail",
            "primary_use_case": "Retail order management",
            "channel": "web_chat",
            "company_name": "Test Corp",
            "expected_capabilities": capabilities,
        },
        "architecture": [
            {
                "name": "Root Agent",
                "slug": "root_agent",
                "agent_type": "root_agent",
                "role_summary": "Routes customer queries to the appropriate specialist agent",
                # Pass capabilities verbatim as handles so we can assert they survive the pipeline.
                "handles": capabilities,
                "suggested_tools": [],
            }
        ],
        "global_settings": {
            "app_display_name": "Test Retail App",
            "model_name": "gemini-2.5-flash",
            "model_temperature": 0.3,
            "default_language": "en",
            "time_zone": "UTC",
            "execution_mode": "parallel",
        },
    }


def _fake_gcs_service() -> tuple[MagicMock, dict]:
    """Return a mock GCSService and a mutable dict that receives captured ZIP bytes."""
    captured: dict[str, bytes] = {}
    svc = MagicMock()

    async def _capture_zip(data: bytes, blob_name: str, content_type: str = "application/zip") -> str:
        if blob_name.startswith("scaffolds/"):
            captured["zip_bytes"] = data
        return "https://storage.googleapis.com/mock-bucket/mock-signed-url"

    svc.upload_and_get_url = _capture_zip
    svc.upload_bytes = AsyncMock(return_value="mock-blob-name")
    return svc, captured


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_scaffold_capabilities_survive_full_pipeline():
    """POST /accelerators/scaffolder/generate with 3 capabilities returns a
    valid ZIP containing app_scaffold/app.json, and the capability strings
    are preserved verbatim in the agent metadata inside the ZIP."""
    capabilities = ["Order Management", "Live Agent Handoff", "Returns Processing"]
    gcs_mock, captured = _fake_gcs_service()

    app.dependency_overrides[get_current_user_with_token] = _override_auth
    try:
        with (
            patch(
                "routers.accelerators.scaffolder.get_gcs_service",
                return_value=gcs_mock,
            ),
            patch("services.architecture_service.get_gemini_service") as mock_gemini,
        ):
            gemini_svc = MagicMock()
            gemini_svc.generate_with_retry = AsyncMock(
                return_value="<role>Scaffold instruction placeholder</role>"
            )
            mock_gemini.return_value = gemini_svc

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/accelerators/scaffolder/generate",
                    json=_make_scaffold_body(capabilities),
                )
    finally:
        app.dependency_overrides.pop(get_current_user_with_token, None)

    assert response.status_code == 200

    # The ZIP must have been captured by the GCS mock
    assert "zip_bytes" in captured, "GCS mock did not receive a ZIP upload"
    zip_bytes = captured["zip_bytes"]

    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        names = zf.namelist()
        assert "app_scaffold/app.json" in names, (
            f"app_scaffold/app.json missing from ZIP. Found: {names}"
        )

        app_json = json.loads(zf.read("app_scaffold/app.json"))

    # app.json must be a valid JSON document with the expected top-level keys
    assert "displayName" in app_json
    assert "toolExecutionMode" in app_json

    # All 3 capability strings must survive the pipeline verbatim.
    # build_scaffold_zip writes agent.handles → agent.json → _gecxhub_metadata.handles
    # (AgentDefinition.handles has no slug-transformation validator).
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        agent_json = json.loads(zf.read("agents/root_agent/agent.json"))

    surviving = agent_json["_gecxhub_metadata"]["handles"]
    assert len(surviving) == len(capabilities), (
        f"Expected {len(capabilities)} handles, got {len(surviving)}: {surviving}"
    )
    for cap in capabilities:
        assert cap in surviving, (
            f"Capability {cap!r} missing from _gecxhub_metadata.handles: {surviving}"
        )


@pytest.mark.asyncio
async def test_scaffold_empty_capabilities_accepted():
    """An empty expected_capabilities list is valid — the endpoint must return 200."""
    gcs_mock, _ = _fake_gcs_service()

    app.dependency_overrides[get_current_user_with_token] = _override_auth
    try:
        with (
            patch(
                "routers.accelerators.scaffolder.get_gcs_service",
                return_value=gcs_mock,
            ),
            patch("services.architecture_service.get_gemini_service") as mock_gemini,
        ):
            gemini_svc = MagicMock()
            gemini_svc.generate_with_retry = AsyncMock(
                return_value="<role>Minimal instruction</role>"
            )
            mock_gemini.return_value = gemini_svc

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/accelerators/scaffolder/generate",
                    json=_make_scaffold_body([]),
                )
    finally:
        app.dependency_overrides.pop(get_current_user_with_token, None)

    assert response.status_code == 200, (
        f"Empty capabilities should be accepted (200), got {response.status_code}: "
        f"{response.text}"
    )


@pytest.mark.asyncio
async def test_scaffold_display_string_not_stripped():
    """Capability display strings must not be slug-transformed anywhere in the pipeline.

    "Customer Identity Verification" must appear verbatim in the agent JSON
    inside the ZIP — it must not be converted to "customer_identity_verification"
    or any other normalised form.
    """
    capability = "Customer Identity Verification"
    gcs_mock, captured = _fake_gcs_service()

    app.dependency_overrides[get_current_user_with_token] = _override_auth
    try:
        with (
            patch(
                "routers.accelerators.scaffolder.get_gcs_service",
                return_value=gcs_mock,
            ),
            patch("services.architecture_service.get_gemini_service") as mock_gemini,
        ):
            gemini_svc = MagicMock()
            gemini_svc.generate_with_retry = AsyncMock(
                return_value="<role>Identity verification agent instruction</role>"
            )
            mock_gemini.return_value = gemini_svc

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/accelerators/scaffolder/generate",
                    json=_make_scaffold_body([capability]),
                )
    finally:
        app.dependency_overrides.pop(get_current_user_with_token, None)

    assert response.status_code == 200
    assert "zip_bytes" in captured, "GCS mock did not receive a ZIP upload"

    with zipfile.ZipFile(io.BytesIO(captured["zip_bytes"]), "r") as zf:
        agent_json_raw = zf.read("agents/root_agent/agent.json").decode("utf-8")

    # The verbatim string must appear in the agent JSON (inside _gecxhub_metadata.handles).
    # If it were slug-transformed it would be "customer_identity_verification".
    assert capability in agent_json_raw, (
        f"Expected verbatim capability {capability!r} in agent.json, "
        f"but it was missing or transformed. agent.json snippet: "
        f"{agent_json_raw[:500]}"
    )
    assert "customer_identity_verification" not in agent_json_raw, (
        "Capability was slug-transformed to 'customer_identity_verification' — "
        "display strings must be preserved as-is."
    )
