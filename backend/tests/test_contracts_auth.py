"""Schemathesis contract tests scoped to auth endpoints only.

Validates that every /auth/* endpoint handles all Schemathesis-generated
input shapes without returning a 500 Internal Server Error.

The OAuth callback endpoint is mocked so no real Google token exchange occurs.
"""

import pytest
from unittest.mock import AsyncMock, patch

import schemathesis.openapi as oa
from main import app

# Filter schema to /auth/* paths only
_base = oa.from_asgi("/openapi.json", app)
schema_auth = _base.include(path_regex=r"^/auth/")


# ── Service mocks ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_google_auth():
    """Prevent real Google OAuth calls during auth contract tests."""
    with (
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
                "sub": "user-auth-contract-001",
                "email": "auth-contract@test.com",
                "name": "Auth Contract User",
                "picture": None,
            }),
        ),
    ):
        yield


# ── Contract test ─────────────────────────────────────────────────────────────

@schema_auth.parametrize()
@pytest.mark.contract
def test_auth_endpoints_never_500(case):
    """Auth endpoints must handle all input shapes without returning 500.

    A 401 or 403 for unauthenticated requests is expected and acceptable.
    A 422 for malformed input is expected and acceptable.
    A 500 means the auth layer crashed on unexpected input — that is a bug.
    """
    response = case.call()
    assert response.status_code != 500, (
        f"Auth endpoint {case.method.upper()} {case.path} returned 500:\n"
        f"{response.text[:300]}"
    )
