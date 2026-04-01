"""Integration tests for the Instructions accelerator router.

Endpoints under test:
  POST /accelerators/instructions/generate-section
  POST /accelerators/instructions/assemble
  POST /accelerators/instructions/push

External dependencies (Gemini, CES) are mocked at the service layer so that
tests run without live GCP credentials.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── TestInstructionRoutes ─────────────────────────────────────────────────────

class TestInstructionRoutes:

    # ── Fixtures ──────────────────────────────────────────────────────────────

    @pytest.fixture
    def mock_gemini(self):
        """Patch Gemini in instruction_service so no real API calls are made."""
        with patch("services.instruction_service.get_gemini_service") as mock:
            service = MagicMock()
            service.generate_with_retry = AsyncMock(
                return_value="<persona>\nYou are Aria, a friendly agent.\n</persona>"
            )
            mock.return_value = service
            yield service

    @pytest.fixture
    def mock_ces_instructions(self):
        """Patch CES in the instructions router."""
        with patch("routers.accelerators.instructions.get_ces_service") as mock:
            service = MagicMock()
            service.get_agent = AsyncMock(
                return_value={
                    "displayName": "Order Support Agent",
                    "instruction": "Old instruction preview text here.",
                }
            )
            service.create_version = AsyncMock(
                return_value={"name": "projects/p/locations/l/apps/a/versions/v42"}
            )
            service.update_agent_instruction = AsyncMock(
                return_value={"displayName": "Order Support Agent"}
            )
            mock.return_value = service
            yield service

    # ── generate-section ──────────────────────────────────────────────────────

    def test_generate_section_requires_auth(self, test_client):
        response = test_client.post(
            "/accelerators/instructions/generate-section", json={}
        )
        assert response.status_code in (401, 403, 422)

    def test_generate_section_persona_returns_200(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona
    ):
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "persona",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
            },
        )
        assert response.status_code == 200

    def test_generate_section_persona_calls_gemini(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona
    ):
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "persona",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert "generated_xml" in body
        assert "<persona>" in body["generated_xml"]
        assert mock_gemini.generate_with_retry.called

    def test_generate_section_returns_token_estimate(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona
    ):
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "persona",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
            },
        )
        body = response.json()
        assert "token_count_estimate" in body
        assert isinstance(body["token_count_estimate"], int)

    def test_generate_section_token_estimate_is_chars_over_four(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona
    ):
        mocked_text = "<persona>\nYou are Aria, a friendly agent.\n</persona>"
        mock_gemini.generate_with_retry = AsyncMock(return_value=mocked_text)

        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "persona",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
            },
        )
        body = response.json()
        expected = len(mocked_text) // 4
        assert body["token_count_estimate"] == expected

    def test_generate_section_returns_section_name(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona
    ):
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "persona",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
            },
        )
        body = response.json()
        assert body["section"] == "persona"

    def test_generate_section_tools_empty_returns_placeholder(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona, sample_scope
    ):
        # No tools → service short-circuits and returns a comment placeholder
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "tools",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": {"tools": []},
            },
        )
        assert response.status_code == 200
        body = response.json()
        # Short-circuit path: no Gemini call needed, returns comment XML
        assert "generated_xml" in body
        assert "<!--" in body["generated_xml"]

    def test_generate_section_sub_agents_empty_returns_placeholder(
        self, test_client, auth_headers, mock_gemini, sample_identity, sample_persona, sample_scope
    ):
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "sub_agents",
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": {"tools": []},
                "sub_agents": {"sub_agents": []},
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert "<!--" in body["generated_xml"]

    def test_generate_section_invalid_section_name_returns_422(
        self, test_client, auth_headers, sample_identity
    ):
        response = test_client.post(
            "/accelerators/instructions/generate-section",
            headers=auth_headers,
            json={
                "section": "nonexistent_section",
                "identity": sample_identity.model_dump(),
            },
        )
        assert response.status_code == 422

    # ── assemble ──────────────────────────────────────────────────────────────

    def test_assemble_requires_auth(self, test_client):
        response = test_client.post(
            "/accelerators/instructions/assemble", json={}
        )
        assert response.status_code in (401, 403, 422)

    def test_assemble_returns_quality_score(
        self,
        test_client,
        auth_headers,
        mock_gemini,
        sample_identity,
        sample_persona,
        sample_scope,
        sample_tools_input,
        sample_error_handling,
    ):
        from models.accelerators.instructions import SubAgentsInput

        response = test_client.post(
            "/accelerators/instructions/assemble",
            headers=auth_headers,
            json={
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": sample_tools_input.model_dump(),
                "sub_agents": SubAgentsInput().model_dump(),
                "error_handling": sample_error_handling.model_dump(),
                "custom_sections": {
                    "persona": "<persona>Custom persona section</persona>",
                    "scope": (
                        "<scope>Scope</scope>"
                        "<task>Tasks</task>"
                        "<escalation>Escalate</escalation>"
                    ),
                    "error_handling": "<error_handling>Handle errors</error_handling>",
                },
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert "quality_score" in body
        assert 0 <= body["quality_score"] <= 100
        assert "quality_checks" in body
        assert isinstance(body["quality_checks"], list)
        assert "instruction" in body
        assert "global_instruction" in body

    def test_assemble_returns_character_count(
        self,
        test_client,
        auth_headers,
        mock_gemini,
        sample_identity,
        sample_persona,
        sample_scope,
        sample_tools_input,
        sample_error_handling,
    ):
        from models.accelerators.instructions import SubAgentsInput

        custom = {
            "persona": "<persona>P</persona>",
            "scope": "<scope>S</scope><task>T</task><escalation>E</escalation>",
            "error_handling": "<error_handling>EH</error_handling>",
        }
        response = test_client.post(
            "/accelerators/instructions/assemble",
            headers=auth_headers,
            json={
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": sample_tools_input.model_dump(),
                "sub_agents": SubAgentsInput().model_dump(),
                "error_handling": sample_error_handling.model_dump(),
                "custom_sections": custom,
            },
        )
        body = response.json()
        assert "character_count" in body
        assert isinstance(body["character_count"], int)
        assert body["character_count"] > 0

    def test_assemble_returns_section_breakdown(
        self,
        test_client,
        auth_headers,
        mock_gemini,
        sample_identity,
        sample_persona,
        sample_scope,
        sample_tools_input,
        sample_error_handling,
    ):
        from models.accelerators.instructions import SubAgentsInput

        response = test_client.post(
            "/accelerators/instructions/assemble",
            headers=auth_headers,
            json={
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": sample_tools_input.model_dump(),
                "sub_agents": SubAgentsInput().model_dump(),
                "error_handling": sample_error_handling.model_dump(),
                "custom_sections": {
                    "persona": "<persona>P</persona>",
                    "scope": "<scope>S</scope><task>T</task><escalation>E</escalation>",
                    "error_handling": "<error_handling>EH</error_handling>",
                },
            },
        )
        body = response.json()
        assert "section_breakdown" in body
        assert isinstance(body["section_breakdown"], dict)
        # Role is always built from identity, so it should always be present
        assert "role" in body["section_breakdown"]

    def test_assemble_quality_checks_have_correct_structure(
        self,
        test_client,
        auth_headers,
        mock_gemini,
        sample_identity,
        sample_persona,
        sample_scope,
        sample_tools_input,
        sample_error_handling,
    ):
        from models.accelerators.instructions import SubAgentsInput

        response = test_client.post(
            "/accelerators/instructions/assemble",
            headers=auth_headers,
            json={
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": sample_tools_input.model_dump(),
                "sub_agents": SubAgentsInput().model_dump(),
                "error_handling": sample_error_handling.model_dump(),
                "custom_sections": {},
            },
        )
        body = response.json()
        for check in body["quality_checks"]:
            assert "dimension" in check
            assert "passed" in check
            assert "message" in check
            assert "severity" in check
            assert check["severity"] in ("error", "warning", "info")

    def test_assemble_instruction_contains_role_section(
        self,
        test_client,
        auth_headers,
        mock_gemini,
        sample_identity,
        sample_persona,
        sample_scope,
        sample_tools_input,
        sample_error_handling,
    ):
        from models.accelerators.instructions import SubAgentsInput

        response = test_client.post(
            "/accelerators/instructions/assemble",
            headers=auth_headers,
            json={
                "identity": sample_identity.model_dump(),
                "persona": sample_persona.model_dump(),
                "scope": sample_scope.model_dump(),
                "tools": sample_tools_input.model_dump(),
                "sub_agents": SubAgentsInput().model_dump(),
                "error_handling": sample_error_handling.model_dump(),
                "custom_sections": {},
            },
        )
        body = response.json()
        assert "<role>" in body["instruction"]
        assert sample_identity.agent_name in body["instruction"]

    # ── push ──────────────────────────────────────────────────────────────────

    def test_push_requires_auth(self, test_client):
        response = test_client.post(
            "/accelerators/instructions/push", json={}
        )
        assert response.status_code in (401, 403, 422)

    def test_push_returns_success_true(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": "<role>You are an agent.</role>",
                "create_version_first": True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True

    def test_push_creates_version_snapshot(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": "<role>New instruction.</role>",
                "create_version_first": True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["version_id"] == "v42"
        assert mock_ces_instructions.create_version.called

    def test_push_skips_version_when_flag_false(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": "<role>New instruction.</role>",
                "create_version_first": False,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["version_id"] is None
        assert not mock_ces_instructions.create_version.called

    def test_push_returns_previous_instruction_preview(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": "<role>New instruction.</role>",
                "create_version_first": False,
            },
        )
        body = response.json()
        assert "previous_instruction_preview" in body
        # Comes from the mocked get_agent response
        assert "Old instruction" in body["previous_instruction_preview"]

    def test_push_returns_applied_instruction_preview(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        new_instruction = "<role>You are an agent.</role>"
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": new_instruction,
                "create_version_first": False,
            },
        )
        body = response.json()
        assert "applied_instruction_preview" in body
        assert body["applied_instruction_preview"] == new_instruction[:200]

    def test_push_version_snapshot_failure_is_non_fatal(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        mock_ces_instructions.create_version = AsyncMock(
            side_effect=Exception("Snapshot service unavailable")
        )
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": "<role>New instruction.</role>",
                "create_version_first": True,
            },
        )
        # Version snapshot failure must not prevent successful instruction push
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["version_id"] is None

    def test_push_calls_update_agent_instruction(
        self, test_client, auth_headers, mock_ces_instructions
    ):
        instruction_text = "<role>You are Order Support Agent.</role>"
        test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={
                "project_id": "test-project",
                "location": "us-central1",
                "app_id": "test-app",
                "agent_id": "order-support-agent",
                "instruction": instruction_text,
                "create_version_first": False,
            },
        )
        mock_ces_instructions.update_agent_instruction.assert_called_once()
        call_args = mock_ces_instructions.update_agent_instruction.call_args
        # instruction text must be passed to CES
        assert instruction_text in call_args.args or instruction_text in call_args.kwargs.values()

    def test_push_missing_required_fields_returns_422(
        self, test_client, auth_headers
    ):
        # project_id, app_id, agent_id, instruction are all required
        response = test_client.post(
            "/accelerators/instructions/push",
            headers=auth_headers,
            json={"location": "us-central1"},
        )
        assert response.status_code == 422
