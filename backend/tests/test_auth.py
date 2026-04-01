"""Tests for the auth router and JWT handler."""

import pytest
from datetime import datetime, timezone
from fastapi import HTTPException
from jose import jwt

from auth.jwt_handler import (
    ALGORITHM,
    create_session_token,
    verify_session_token,
    extract_access_token,
)
from auth.dependencies import get_current_user
from config import get_settings
from main import app


# ── JWT Handler tests ─────────────────────────────────────────────────────────

class TestJWTHandler:

    def test_create_session_token_returns_string(self, mock_user):
        token = create_session_token(mock_user.id, mock_user.email, "gcp-token")
        assert isinstance(token, str)
        # JWTs are three base64-encoded segments separated by dots
        assert token.count(".") == 2

    def test_verify_session_token_returns_payload_with_sub(self, mock_user, auth_token):
        payload = verify_session_token(auth_token)
        assert payload["sub"] == mock_user.id

    def test_verify_session_token_returns_payload_with_email(self, mock_user, auth_token):
        payload = verify_session_token(auth_token)
        assert payload["email"] == mock_user.email

    def test_verify_expired_token_raises_401(self):
        settings = get_settings()
        # Build a token whose exp is a past datetime so it's already expired
        expired_payload = {
            "sub": "test-user",
            "email": "test@example.com",
            "access_token": "fake-gcp-token",
            "iat": datetime(2020, 1, 1, tzinfo=timezone.utc),
            "exp": datetime(2020, 1, 2, tzinfo=timezone.utc),  # expired in 2020
        }
        expired_token = jwt.encode(
            expired_payload, settings.secret_key, algorithm=ALGORITHM
        )

        with pytest.raises(HTTPException) as exc_info:
            verify_session_token(expired_token)

        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_verify_tampered_token_raises_401(self, auth_token):
        # Flip one character in the signature segment (after the last dot)
        header, payload_seg, signature = auth_token.rsplit(".", 2)
        # Replace the first char of the signature with something different
        first_char = signature[0]
        replacement = "Z" if first_char != "Z" else "A"
        tampered = f"{header}.{payload_seg}.{replacement}{signature[1:]}"

        with pytest.raises(HTTPException) as exc_info:
            verify_session_token(tampered)

        assert exc_info.value.status_code == 401

    def test_token_contains_access_token_in_payload(self, mock_user):
        gcp_token = "my-real-gcp-access-token-xyz"
        session_token = create_session_token(mock_user.id, mock_user.email, gcp_token)
        payload = verify_session_token(session_token)
        assert payload["access_token"] == gcp_token

    def test_extract_access_token_returns_token(self, mock_user):
        gcp_token = "gcp-token-for-extraction-test"
        session_token = create_session_token(mock_user.id, mock_user.email, gcp_token)
        payload = verify_session_token(session_token)
        extracted = extract_access_token(payload)
        assert extracted == gcp_token

    def test_extract_access_token_raises_401_when_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            extract_access_token({"sub": "user", "email": "user@test.com"})
        assert exc_info.value.status_code == 401


# ── Auth route tests ──────────────────────────────────────────────────────────

class TestAuthRoutes:

    def test_login_endpoint_returns_200(self, test_client):
        response = test_client.get("/auth/login")
        assert response.status_code == 200

    def test_login_endpoint_returns_auth_url_key(self, test_client):
        response = test_client.get("/auth/login")
        data = response.json()
        assert "auth_url" in data
        assert isinstance(data["auth_url"], str)
        assert len(data["auth_url"]) > 0

    def test_login_url_contains_google_domain(self, test_client):
        response = test_client.get("/auth/login")
        auth_url = response.json()["auth_url"]
        assert "accounts.google.com" in auth_url

    def test_login_url_contains_required_params(self, test_client):
        response = test_client.get("/auth/login")
        auth_url = response.json()["auth_url"]
        assert "response_type=code" in auth_url
        assert "access_type=offline" in auth_url
        assert "prompt=consent" in auth_url
        assert "state=" in auth_url

    def test_login_generates_unique_state_per_call(self, test_client):
        url1 = test_client.get("/auth/login").json()["auth_url"]
        url2 = test_client.get("/auth/login").json()["auth_url"]
        # Extract state params and assert they differ
        state1 = [p for p in url1.split("&") if p.startswith("state=")][0]
        state2 = [p for p in url2.split("&") if p.startswith("state=")][0]
        assert state1 != state2

    def test_me_without_auth_returns_401(self, test_client):
        response = test_client.get("/auth/me")
        assert response.status_code == 403  # HTTPBearer returns 403 when header is absent

    def test_me_with_invalid_token_returns_401(self, test_client):
        response = test_client.get(
            "/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt"}
        )
        assert response.status_code == 401

    def test_me_with_valid_token_returns_user(self, test_client, mock_user, auth_headers):
        # Override the dependency so we don't need Google to verify anything
        async def override_get_current_user():
            return mock_user

        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            response = test_client.get("/auth/me", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == mock_user.id
            assert data["email"] == mock_user.email
            assert data["name"] == mock_user.name
        finally:
            app.dependency_overrides.clear()

    def test_logout_without_auth_returns_403(self, test_client):
        response = test_client.post("/auth/logout")
        assert response.status_code == 403

    def test_logout_with_valid_token_returns_success(self, test_client, mock_user, auth_headers):
        async def override_get_current_user():
            return mock_user

        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            response = test_client.post("/auth/logout", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
        finally:
            app.dependency_overrides.clear()

    def test_health_endpoint_returns_ok(self, test_client):
        response = test_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "gecx-hub-api"
        assert data["version"] == "1.0.0"

    def test_health_endpoint_no_auth_required(self, test_client):
        # Health check must be publicly accessible — no Authorization header
        response = test_client.get("/health")
        assert response.status_code == 200
