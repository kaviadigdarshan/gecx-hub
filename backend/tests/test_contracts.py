"""Schemathesis contract tests: every endpoint must handle arbitrary inputs without 500 errors.

These are not functional tests — they validate API robustness by generating
hundreds of fuzz cases from the OpenAPI spec. Any 5xx response is a bug.
4xx responses are acceptable (bad input, not found, auth failures, etc.).

Schemathesis 4.x API:
  - schemathesis.openapi.from_asgi("/openapi.json", app)  (not schemathesis.from_asgi)
  - case.call(headers={...})                               (not case.call_asgi)
  - schema.include(path_regex=...).parametrize()          (not @schema.parametrize(endpoint=...))
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import schemathesis.openapi as oa
from main import app
from auth.jwt_handler import create_session_token

schema = oa.from_asgi("/openapi.json", app)


# ── Auth fixture ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def valid_auth_token():
    return create_session_token(
        "schema-test-user",
        "schema@test.com",
        "fake-gcp-token",
    )


# ── Service mocks ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_external_services():
    """Prevent any real GCP/Gemini calls during contract tests.

    Without these mocks, many endpoints would return 502 (Gemini/CES unreachable)
    or 500 (unhandled exceptions from missing credentials).  The contract tests
    only care that the *application code* doesn't produce unhandled 500s —
    infrastructure failures are expected in CI.
    """
    mock_gcs = MagicMock()
    mock_gcs.upload_and_get_url = AsyncMock(
        return_value="https://storage.googleapis.com/test/signed-url"
    )
    mock_gcs.upload_bytes = AsyncMock(return_value=None)
    mock_gcs.download_bytes = AsyncMock(side_effect=FileNotFoundError("not found"))

    mock_ces = MagicMock()
    mock_ces.get_agent = AsyncMock(
        return_value={"displayName": "Test Agent", "instruction": ""}
    )
    mock_ces.create_version = AsyncMock(
        return_value={"name": "projects/p/locations/l/apps/a/versions/v1"}
    )
    mock_ces.update_agent_instruction = AsyncMock(
        return_value={"displayName": "Test Agent"}
    )
    mock_ces.list_agents = AsyncMock(return_value=[])
    mock_ces.list_tools = AsyncMock(return_value=[])
    mock_ces.create_guardrail = AsyncMock(
        return_value={"name": "projects/p/locations/l/apps/a/guardrails/g1"}
    )
    mock_ces.import_app = AsyncMock(
        return_value={"name": "projects/p/locations/l/apps/a"}
    )

    mock_gemini = MagicMock()
    mock_gemini.generate_structured_json = AsyncMock(return_value={
        "agents": [
            {
                "name": "Root Agent",
                "slug": "root_agent",
                "agent_type": "root_agent",
                "role_summary": "Routes all queries",
                "handles": [],
                "suggested_tools": [],
                "ai_generated": True,
            }
        ],
        "rationale": "Single root agent for simplicity",
        "decomposition_strategy": "capability_based",
        "root_agent_style": "pure_router",
        "estimated_complexity": "simple",
    })
    mock_gemini.generate_with_retry = AsyncMock(
        return_value="<role>\nYou are a helpful agent.\n</role>"
    )

    with (
        patch("routers.context.get_gcs_service", return_value=mock_gcs),
        patch("routers.accelerators.guardrails.get_gcs_service", return_value=mock_gcs),
        patch("routers.accelerators.scaffolder.get_gcs_service", return_value=mock_gcs),
        patch("routers.accelerators.instructions.get_ces_service", return_value=mock_ces),
        patch("routers.accelerators.guardrails.get_ces_service", return_value=mock_ces),
        patch("routers.accelerators.scaffolder.get_ces_service", return_value=mock_ces),
        patch("services.architecture_service.get_gemini_service", return_value=mock_gemini),
        patch("services.instruction_service.get_gemini_service", return_value=mock_gemini),
        patch(
            "services.resource_manager.list_projects",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "services.ces_service.list_apps",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "auth.google_auth.exchange_code_for_tokens",
            new=AsyncMock(return_value={
                "access_token": "fake-google-token",
                "id_token": "fake-id-token",
            }),
        ),
        patch(
            "auth.google_auth.get_user_info",
            new=AsyncMock(return_value={
                "sub": "user-contract-001",
                "email": "contract@test.com",
                "name": "Contract Test User",
                "picture": None,
            }),
        ),
    ):
        yield


# ── Contract test ─────────────────────────────────────────────────────────────

@schema.parametrize()
@pytest.mark.contract
@pytest.mark.integration
def test_api_schema_compliance(case, valid_auth_token):
    """Schemathesis generates hundreds of test cases from the OpenAPI spec.

    Every endpoint must return a non-5xx response (or a documented 4xx).
    Auth-protected routes get the valid token injected via the headers kwarg.
    """
    response = case.call(
        headers={"Authorization": f"Bearer {valid_auth_token}"}
    )

    assert response.status_code < 500, (
        f"Endpoint {case.method.upper()} {case.path} returned {response.status_code}:\n"
        f"{response.text[:300]}"
    )
