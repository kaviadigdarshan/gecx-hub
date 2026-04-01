"""Integration tests for the Scaffolder accelerator router.

Endpoints under test:
  POST /accelerators/scaffolder/suggest-architecture
  POST /accelerators/scaffolder/generate
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# Override the conftest mock_gcs to patch the scaffolder router instead of guardrails
@pytest.fixture
def mock_gcs():
    with patch("routers.accelerators.scaffolder.get_gcs_service") as mock:
        service = MagicMock()
        service.upload_and_get_url = AsyncMock(
            return_value="https://storage.googleapis.com/test/scaffold-signed-url"
        )
        mock.return_value = service
        yield service


class TestScaffolderRoutes:

    def test_suggest_requires_auth(self, test_client):
        response = test_client.post("/accelerators/scaffolder/suggest-architecture", json={})
        assert response.status_code in (401, 403, 422)

    def test_generate_requires_auth(self, test_client):
        response = test_client.post("/accelerators/scaffolder/generate", json={})
        assert response.status_code in (401, 403, 422)

    def test_suggest_calls_gemini_and_returns_agents(
        self, test_client, auth_headers, mock_architecture_gemini, sample_use_case
    ):
        response = test_client.post(
            "/accelerators/scaffolder/suggest-architecture",
            headers=auth_headers,
            json={"use_case": sample_use_case.model_dump()}
        )
        assert response.status_code == 200
        body = response.json()
        assert "agents" in body
        assert len(body["agents"]) >= 1
        assert "rationale" in body

    def test_suggest_response_has_one_root_agent(
        self, test_client, auth_headers, mock_architecture_gemini, sample_use_case
    ):
        response = test_client.post(
            "/accelerators/scaffolder/suggest-architecture",
            headers=auth_headers,
            json={"use_case": sample_use_case.model_dump()}
        )
        agents = response.json()["agents"]
        root_count = sum(1 for a in agents if a["agent_type"] == "root_agent")
        assert root_count == 1

    def test_generate_returns_download_url(
        self, test_client, auth_headers, mock_architecture_gemini, mock_gcs,
        sample_scaffold_request
    ):
        response = test_client.post(
            "/accelerators/scaffolder/generate",
            headers=auth_headers,
            json=sample_scaffold_request.model_dump()
        )
        assert response.status_code == 200
        body = response.json()
        assert "download_url" in body
        assert body["download_url"].startswith("https://")

    def test_generate_returns_correct_agent_count(
        self, test_client, auth_headers, mock_architecture_gemini, mock_gcs,
        sample_scaffold_request
    ):
        response = test_client.post(
            "/accelerators/scaffolder/generate",
            headers=auth_headers,
            json=sample_scaffold_request.model_dump()
        )
        body = response.json()
        assert body["agent_count"] == len(sample_scaffold_request.architecture)

    def test_generate_request_without_root_agent_fails_validation(
        self, test_client, auth_headers, sample_use_case, sample_global_settings
    ):
        from models.accelerators.scaffolder import AgentDefinition
        no_root_architecture = [
            AgentDefinition(
                name="Only Sub", slug="only_sub", agent_type="sub_agent",
                role_summary="Test", handles=[], suggested_tools=[]
            ).model_dump()
        ]
        response = test_client.post(
            "/accelerators/scaffolder/generate",
            headers=auth_headers,
            json={
                "use_case": sample_use_case.model_dump(),
                "architecture": no_root_architecture,
                "tool_stubs": [],
                "global_settings": sample_global_settings.model_dump(),
            }
        )
        assert response.status_code == 422

    def test_generate_includes_architecture_summary(
        self, test_client, auth_headers, mock_architecture_gemini, mock_gcs,
        sample_scaffold_request
    ):
        response = test_client.post(
            "/accelerators/scaffolder/generate",
            headers=auth_headers,
            json=sample_scaffold_request.model_dump()
        )
        body = response.json()
        assert "architecture_summary" in body
        assert len(body["architecture_summary"]) > 0
