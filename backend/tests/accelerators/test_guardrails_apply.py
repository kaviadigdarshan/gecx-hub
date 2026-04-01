"""Integration tests for POST /accelerators/guardrails/apply."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from auth.dependencies import get_current_user, get_current_user_with_token
from main import app


# ── Shared helpers ────────────────────────────────────────────────────────────

def _apply_payload(guardrails: list[dict] | None = None) -> dict:
    return {
        "project_id": "my-gcp-project",
        "location": "us-central1",
        "app_id": "my-ces-app",
        "guardrails": guardrails
        if guardrails is not None
        else [
            {
                "displayName": "Content Blocklist",
                "contentFilter": {"bannedContents": ["violence"]},
                "action": {
                    "respondImmediately": {
                        "responses": [{"text": "I cannot assist with that."}]
                    }
                },
                "enabled": True,
            }
        ],
    }


# ── TestGuardrailsApplyEndpoint ───────────────────────────────────────────────

class TestGuardrailsApplyEndpoint:

    def test_apply_without_auth_returns_403(self, test_client):
        response = test_client.post(
            "/accelerators/guardrails/apply", json=_apply_payload()
        )
        assert response.status_code == 403

    def test_apply_with_valid_token_returns_200(
        self, test_client, mock_user, auth_headers, mock_ces
    ):
        async def override():
            return (mock_user, "fake-gcp-token")

        app.dependency_overrides[get_current_user_with_token] = override
        try:
            response = test_client.post(
                "/accelerators/guardrails/apply",
                headers=auth_headers,
                json=_apply_payload(),
            )
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()

    def test_apply_response_counts_successes(
        self, test_client, mock_user, auth_headers, mock_ces
    ):
        guardrails = [
            {
                "displayName": "Content Blocklist",
                "contentFilter": {"bannedContents": ["spam"]},
                "action": {
                    "respondImmediately": {
                        "responses": [{"text": "No."}]
                    }
                },
                "enabled": True,
            },
            {
                "displayName": "Model Safety (Balanced)",
                "modelSafety": {
                    "safetySettings": [
                        {
                            "harmCategory": "HARM_CATEGORY_HARASSMENT",
                            "harmBlockThreshold": "BLOCK_MEDIUM_AND_ABOVE",
                        }
                    ]
                },
                "action": {
                    "respondImmediately": {
                        "responses": [{"text": "No."}]
                    }
                },
                "enabled": True,
            },
        ]

        async def override():
            return (mock_user, "fake-gcp-token")

        app.dependency_overrides[get_current_user_with_token] = override
        try:
            response = test_client.post(
                "/accelerators/guardrails/apply",
                headers=auth_headers,
                json=_apply_payload(guardrails=guardrails),
            )
            data = response.json()
            assert data["applied_count"] == 2
            assert data["failed_count"] == 0
        finally:
            app.dependency_overrides.clear()

    def test_apply_partial_failure_is_reported(
        self, test_client, mock_user, auth_headers
    ):
        """When create_guardrail raises on the second call, failed_count should be 1."""
        success_response = {"name": "projects/p/locations/l/apps/a/guardrails/g1"}
        call_count = 0

        async def flaky_create_guardrail(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("Simulated CES failure")
            return success_response

        mock_ces_service = MagicMock()
        mock_ces_service.create_guardrail = flaky_create_guardrail
        mock_ces_service.create_version = AsyncMock(
            return_value={"name": "projects/p/locations/l/apps/a/versions/v1"}
        )

        async def override():
            return (mock_user, "fake-gcp-token")

        guardrails = [
            {
                "displayName": "Content Blocklist",
                "contentFilter": {"bannedContents": ["spam"]},
                "action": {
                    "respondImmediately": {"responses": [{"text": "No."}]}
                },
                "enabled": True,
            },
            {
                "displayName": "Model Safety",
                "modelSafety": {"safetySettings": []},
                "action": {
                    "respondImmediately": {"responses": [{"text": "No."}]}
                },
                "enabled": True,
            },
        ]

        app.dependency_overrides[get_current_user_with_token] = override
        with patch(
            "routers.accelerators.guardrails.get_ces_service",
            return_value=mock_ces_service,
        ):
            try:
                response = test_client.post(
                    "/accelerators/guardrails/apply",
                    headers=auth_headers,
                    json=_apply_payload(guardrails=guardrails),
                )
                data = response.json()
                assert data["applied_count"] == 1
                assert data["failed_count"] == 1
                failed_results = [r for r in data["results"] if r["status"] == "failed"]
                assert len(failed_results) == 1
                assert "Simulated CES failure" in failed_results[0]["error"]
            finally:
                app.dependency_overrides.clear()

    def test_apply_version_snapshot_failure_does_not_abort(
        self, test_client, mock_user, auth_headers
    ):
        """A version snapshot failure must be non-fatal: apply should still return 200."""
        mock_ces_service = MagicMock()
        mock_ces_service.create_version = AsyncMock(
            side_effect=RuntimeError("Snapshot unavailable")
        )
        mock_ces_service.create_guardrail = AsyncMock(
            return_value={"name": "projects/p/locations/l/apps/a/guardrails/g1"}
        )

        async def override():
            return (mock_user, "fake-gcp-token")

        app.dependency_overrides[get_current_user_with_token] = override
        with patch(
            "routers.accelerators.guardrails.get_ces_service",
            return_value=mock_ces_service,
        ):
            try:
                response = test_client.post(
                    "/accelerators/guardrails/apply",
                    headers=auth_headers,
                    json=_apply_payload(),
                )
                assert response.status_code == 200
                data = response.json()
                assert data["applied_count"] == 1
                assert data["version_id"] is None
            finally:
                app.dependency_overrides.clear()
