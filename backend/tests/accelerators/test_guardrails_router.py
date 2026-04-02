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

    def test_generate_returns_guardrail_names_list(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "guardrail_names" in body
        assert isinstance(body["guardrail_names"], list)

    def test_generate_returns_22_guardrail_names(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        names = response.json()["guardrail_names"]
        assert len(names) == 22

    def test_generate_guardrail_names_are_strings(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        for name in response.json()["guardrail_names"]:
            assert isinstance(name, str), f"Expected string, got {type(name)}: {name}"

    def test_generate_returns_guardrail_configs_dict(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "guardrail_configs" in body
        assert isinstance(body["guardrail_configs"], dict)

    def test_generate_configs_keys_match_names(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        names = set(body["guardrail_names"])
        config_keys = set(body["guardrail_configs"].keys())
        assert names == config_keys

    def test_generate_returns_configs_by_cluster(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        body = response.json()
        assert "configs_by_cluster" in body
        assert isinstance(body["configs_by_cluster"], dict)

    def test_generate_configs_by_cluster_has_5_clusters(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        clusters = response.json()["configs_by_cluster"]
        assert len(clusters) == 5

    def test_generate_configs_by_cluster_has_correct_keys(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        clusters = response.json()["configs_by_cluster"]
        expected = {"Safety", "Compliance", "Brand/Business", "Content", "Experience"}
        assert set(clusters.keys()) == expected

    def test_generate_without_project_id_returns_null_scaffold_context(
        self, test_client, auth_headers, mock_gcs_local, valid_generate_payload
    ):
        """No project_id → context write-back is skipped, field is null."""
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=valid_generate_payload,
        )
        assert response.status_code == 200
        assert response.json()["updated_scaffold_context"] is None


# ── TestGuardrailsContextWriteback ────────────────────────────────────────────

import json as _json
from datetime import datetime, timezone


def _minimal_scaffold_context_json() -> bytes:
    """Minimal valid ScaffoldContext JSON for GCS download mock."""
    ctx = {
        "scaffold_id": "ctx-test-001",
        "app_display_name": "Test App",
        "business_domain": "retail",
        "channel": "web_chat",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return _json.dumps(ctx).encode("utf-8")


@pytest.fixture
def mock_gcs_with_context():
    """GCS mock that returns a valid ScaffoldContext on download."""
    with patch("routers.accelerators.guardrails.get_gcs_service") as mock:
        service = MagicMock()
        service.upload_and_get_url = AsyncMock(
            return_value="https://storage.googleapis.com/test/guardrails-signed-url"
        )
        service.download_bytes = AsyncMock(return_value=_minimal_scaffold_context_json())
        service.upload_bytes = AsyncMock(return_value=None)
        mock.return_value = service
        yield service


@pytest.fixture
def mock_gcs_no_context():
    """GCS mock where download raises FileNotFoundError (no existing context)."""
    with patch("routers.accelerators.guardrails.get_gcs_service") as mock:
        service = MagicMock()
        service.upload_and_get_url = AsyncMock(
            return_value="https://storage.googleapis.com/test/guardrails-signed-url"
        )
        service.download_bytes = AsyncMock(side_effect=FileNotFoundError("not found"))
        service.upload_bytes = AsyncMock(return_value=None)
        mock.return_value = service
        yield service


class TestGuardrailsContextWriteback:

    def test_with_project_id_and_existing_context_returns_updated_context(
        self, test_client, auth_headers, mock_gcs_with_context, valid_generate_payload
    ):
        payload = {**valid_generate_payload, "project_id": "test-project-123"}
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["updated_scaffold_context"] is not None

    def test_updated_context_has_guardrail_names_populated(
        self, test_client, auth_headers, mock_gcs_with_context, valid_generate_payload
    ):
        payload = {**valid_generate_payload, "project_id": "test-project-123"}
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        ctx = response.json()["updated_scaffold_context"]
        assert "guardrail_names" in ctx
        assert isinstance(ctx["guardrail_names"], list)
        assert len(ctx["guardrail_names"]) == 22

    def test_updated_context_has_guardrails_applied_true(
        self, test_client, auth_headers, mock_gcs_with_context, valid_generate_payload
    ):
        payload = {**valid_generate_payload, "project_id": "test-project-123"}
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        ctx = response.json()["updated_scaffold_context"]
        assert ctx["guardrails_applied"] is True
        assert ctx["guardrails_industry"] == "retail"

    def test_gcs_upload_bytes_called_when_context_updated(
        self, test_client, auth_headers, mock_gcs_with_context, valid_generate_payload
    ):
        payload = {**valid_generate_payload, "project_id": "test-project-123"}
        test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        mock_gcs_with_context.upload_bytes.assert_called_once()

    def test_missing_context_in_gcs_returns_null_scaffold_context(
        self, test_client, auth_headers, mock_gcs_no_context, valid_generate_payload
    ):
        """When GCS has no existing context, write-back is skipped — not a 500."""
        payload = {**valid_generate_payload, "project_id": "test-project-123"}
        response = test_client.post(
            "/accelerators/guardrails/generate",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["updated_scaffold_context"] is None
