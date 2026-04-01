"""Integration tests for the Guardrails accelerator router.

Endpoints under test:
  POST /accelerators/guardrails/generate

External dependencies (GCS) are mocked at the service layer so that
tests run without live GCP credentials.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── Module-level fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def mock_gcs_local():
    """Patch GCS in the guardrails router so no real uploads are made."""
    with patch("routers.accelerators.guardrails.get_gcs_service") as mock:
        service = MagicMock()
        service.upload_and_get_url = AsyncMock(
            return_value="https://storage.googleapis.com/test/guardrails-signed-url"
        )
        mock.return_value = service
        yield service


@pytest.fixture
def default_action():
    return {
        "action_type": "RESPOND_IMMEDIATELY",
        "canned_response": "I cannot assist with that request.",
        "target_agent": None,
        "generative_prompt": None,
    }


@pytest.fixture
def valid_generate_payload(default_action):
    return {
        "industry_vertical": "retail",
        "agent_persona_type": "customer_service",
        "sensitivity_level": "balanced",
        "competitor_names": ["BrandX", "BrandY"],
        "custom_blocked_phrases": ["hate speech"],
        "custom_policy_rules": "",
        "enable_prompt_injection_guard": True,
        "default_action": default_action,
    }


# ── TestGuardrailsGenerateRoute ───────────────────────────────────────────────

class TestGuardrailsGenerateRoute:

    def test_generate_requires_auth(self, test_client, valid_generate_payload):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            json=valid_generate_payload,
        )
        assert response.status_code in (401, 403)

    def test_generate_returns_200_with_valid_payload(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        assert response.status_code == 200

    def test_generate_returns_download_url(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "download_url" in body
        assert body["download_url"].startswith("https://")

    def test_generate_returns_request_id(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "request_id" in body
        assert len(body["request_id"]) > 0

    def test_generate_returns_previews_list(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "previews" in body
        assert isinstance(body["previews"], list)
        assert len(body["previews"]) >= 1

    def test_generate_each_preview_has_required_fields(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        for preview in response.json()["previews"]:
            assert "guardrail_type" in preview
            assert "display_name" in preview
            assert "description" in preview
            assert "enabled" in preview

    def test_generate_returns_zip_filename(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "zip_filename" in body
        assert body["zip_filename"].endswith(".zip")
        assert "retail" in body["zip_filename"]

    def test_generate_returns_apply_ready_true(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert body["apply_ready"] is True

    def test_generate_returns_industry_preset_used(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert body["industry_preset_used"] == "retail"

    def test_generate_calls_gcs_upload(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        mock_gcs_local.upload_and_get_url.assert_called_once()

    def test_generate_bfsi_vertical_succeeds(
        self, test_client, auth_headers, mock_gcs_local, default_action
    ):
        payload = {
            "industry_vertical": "bfsi",
            "agent_persona_type": "payment_support",
            "sensitivity_level": "strict",
            "competitor_names": [],
            "custom_blocked_phrases": [],
            "custom_policy_rules": "",
            "enable_prompt_injection_guard": True,
            "default_action": default_action,
        }
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["industry_preset_used"] == "bfsi"

    def test_generate_invalid_vertical_returns_422(
        self, test_client, auth_headers, default_action
    ):
        payload = {
            "industry_vertical": "not_a_real_vertical",
            "agent_persona_type": "customer_service",
            "sensitivity_level": "balanced",
            "default_action": default_action,
        }
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 422

    def test_generate_missing_default_action_returns_422(
        self, test_client, auth_headers
    ):
        payload = {
            "industry_vertical": "retail",
            "agent_persona_type": "customer_service",
            "sensitivity_level": "balanced",
        }
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 422

    def test_generate_respond_immediately_without_canned_response_returns_422(
        self, test_client, auth_headers
    ):
        """RESPOND_IMMEDIATELY requires canned_response — validator must reject absent value."""
        payload = {
            "industry_vertical": "retail",
            "agent_persona_type": "customer_service",
            "sensitivity_level": "balanced",
            "default_action": {
                "action_type": "RESPOND_IMMEDIATELY",
                "canned_response": None,
                "target_agent": None,
                "generative_prompt": None,
            },
        }
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 422

    def test_generate_returns_generation_timestamp(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "generation_timestamp" in body
        assert "T" in body["generation_timestamp"]  # ISO 8601 format
