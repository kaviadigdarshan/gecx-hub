"""Unit tests for scaffolder_service builder functions.

Tests cover: build_environment_json, build_app_json, build_agent_json,
build_tool_stub_json, build_ascii_diagram, generate_minimal_instruction_scaffold,
and the async build_scaffold_zip orchestrator.
"""

import pytest


class TestBuildEnvironmentJson:

    def test_contains_standard_gcp_vars(self, sample_tool_stubs, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_environment_json
        result = build_environment_json(sample_tool_stubs, sample_global_settings, sample_use_case.model_dump())
        assert "GCP_PROJECT_ID" in result["envVars"]
        assert "GCP_LOCATION" in result["envVars"]

    def test_all_values_use_dollar_prefix(self, sample_tool_stubs, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_environment_json
        result = build_environment_json(sample_tool_stubs, sample_global_settings, sample_use_case.model_dump())
        for key, value in result["envVars"].items():
            assert value.startswith("$"), f"Env var {key} value '{value}' does not start with $"

    def test_tool_base_url_vars_included(self, sample_tool_stubs, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_environment_json
        result = build_environment_json(sample_tool_stubs, sample_global_settings, sample_use_case.model_dump())
        assert "ORDER_API_BASE_URL" in result["envVars"]

    def test_no_tool_stubs_still_has_gcp_vars(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_environment_json
        result = build_environment_json([], sample_global_settings, sample_use_case.model_dump())
        assert len(result["envVars"]) >= 2   # at least GCP_PROJECT_ID + GCP_LOCATION

    def test_environment_json_has_name_field(self, sample_tool_stubs, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_environment_json
        result = build_environment_json(sample_tool_stubs, sample_global_settings, sample_use_case.model_dump())
        assert result.get("name") == "environment"


class TestBuildAppJson:

    def test_contains_display_name(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "Global instruction")
        assert result["displayName"] == sample_global_settings.app_display_name

    def test_contains_global_instruction(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "My global instruction")
        assert result["globalInstruction"] == "My global instruction"

    def test_logging_config_reflects_settings(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert result["loggingConfig"]["enabled"] == sample_global_settings.logging_enabled

    def test_language_code_set(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert result.get("languageCode") == "en-US"


class TestBuildAgentJson:

    def test_contains_display_name(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        agent = sample_agents[1]
        result = build_agent_json(agent, "<role>Test</role>")
        assert result["displayName"] == agent.name

    def test_instruction_set_correctly(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        agent = sample_agents[0]
        instruction = "<role>\nYou are Root Agent.\n</role>"
        result = build_agent_json(agent, instruction)
        assert result["instruction"] == instruction

    def test_tools_and_sub_agents_start_empty(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        for agent in sample_agents:
            result = build_agent_json(agent, "instruction")
            assert result["tools"] == []
            assert result["subAgents"] == []

    def test_metadata_contains_agent_type(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        root = sample_agents[0]
        result = build_agent_json(root, "instruction")
        assert result["_gecxhub_metadata"]["agent_type"] == "root_agent"

    def test_metadata_contains_handles(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        sub = sample_agents[1]
        result = build_agent_json(sub, "instruction")
        assert "returns_refunds" in result["_gecxhub_metadata"]["handles"]


class TestBuildToolStubJson:

    def test_contains_display_name(self, sample_tool_stubs):
        from services.scaffolder_service import build_tool_stub_json
        result = build_tool_stub_json(sample_tool_stubs[0])
        assert result["displayName"] == sample_tool_stubs[0].display_name

    def test_openapi_spec_uses_env_var_for_server_url(self, sample_tool_stubs):
        from services.scaffolder_service import build_tool_stub_json
        import json
        result = build_tool_stub_json(sample_tool_stubs[0])
        spec_text = result["openApiSpec"]["text"]
        spec = json.loads(spec_text)
        server_url = spec["servers"][0]["url"]
        assert server_url.startswith("$")

    def test_api_key_auth_adds_auth_config(self, sample_tool_stubs):
        from services.scaffolder_service import build_tool_stub_json
        tool = sample_tool_stubs[0]
        assert tool.auth_type == "api_key"
        result = build_tool_stub_json(tool)
        assert "authConfig" in result
        assert "apiKeyConfig" in result["authConfig"]

    def test_no_auth_type_excludes_auth_config(self):
        from services.scaffolder_service import build_tool_stub_json
        from models.accelerators.scaffolder import ToolStubConfig
        tool = ToolStubConfig(
            tool_name="public_api",
            display_name="Public API",
            description="No auth needed",
            base_url_env_var="PUBLIC_API_URL",
            auth_type="none",
        )
        result = build_tool_stub_json(tool)
        assert "authConfig" not in result


class TestBuildAsciiDiagram:

    def test_root_agent_appears_first(self, sample_agents):
        from services.scaffolder_service import build_ascii_diagram
        result = build_ascii_diagram(sample_agents)
        lines = result.strip().split("\n")
        assert "[ROOT]" in lines[0]

    def test_sub_agents_use_tree_connectors(self, sample_agents):
        from services.scaffolder_service import build_ascii_diagram
        result = build_ascii_diagram(sample_agents)
        assert "├──" in result or "└──" in result

    def test_all_agent_names_appear(self, sample_agents):
        from services.scaffolder_service import build_ascii_diagram
        result = build_ascii_diagram(sample_agents)
        for agent in sample_agents:
            assert agent.name in result

    def test_no_agents_returns_fallback(self):
        from services.scaffolder_service import build_ascii_diagram
        result = build_ascii_diagram([])
        assert result  # non-empty string

    def test_single_agent_no_connectors(self):
        from services.scaffolder_service import build_ascii_diagram
        from models.accelerators.scaffolder import AgentDefinition
        single = [AgentDefinition(
            name="Root Agent", slug="root_agent", agent_type="root_agent",
            role_summary="Only agent", handles=[], suggested_tools=[]
        )]
        result = build_ascii_diagram(single)
        assert "├──" not in result
        assert "└──" not in result


class TestMinimalInstructionScaffold:

    def test_scaffold_contains_role_tags(self, sample_agents, sample_use_case):
        from services.architecture_service import generate_minimal_instruction_scaffold
        result = generate_minimal_instruction_scaffold(sample_agents[0], sample_use_case.model_dump())
        assert "<role>" in result and "</role>" in result

    def test_scaffold_contains_configure_markers(self, sample_agents, sample_use_case):
        from services.architecture_service import generate_minimal_instruction_scaffold
        result = generate_minimal_instruction_scaffold(sample_agents[0], sample_use_case.model_dump())
        assert "[CONFIGURE:" in result

    def test_root_agent_scaffold_has_delegation(self, sample_agents, sample_use_case):
        from services.architecture_service import generate_minimal_instruction_scaffold
        root = sample_agents[0]
        assert root.agent_type == "root_agent"
        result = generate_minimal_instruction_scaffold(root, sample_use_case.model_dump())
        assert "<delegation>" in result

    def test_sub_agent_scaffold_has_tool_usage_when_tools(self, sample_agents, sample_use_case):
        from services.architecture_service import generate_minimal_instruction_scaffold
        sub = sample_agents[1]   # has suggested_tools
        result = generate_minimal_instruction_scaffold(sub, sample_use_case.model_dump())
        assert "<tool_usage>" in result

    def test_agent_name_in_scaffold(self, sample_agents, sample_use_case):
        from services.architecture_service import generate_minimal_instruction_scaffold
        sub = sample_agents[1]
        result = generate_minimal_instruction_scaffold(sub, sample_use_case.model_dump())
        assert sub.name in result


class TestBuildScaffoldZip:

    @pytest.mark.asyncio
    async def test_zip_contains_environment_json(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {"root_agent": "<role>Root</role>", "order_support_agent": "<role>Order</role>", "loyalty_agent": "<role>Loyalty</role>"}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "app_scaffold/environment.json" in zf.namelist()

    @pytest.mark.asyncio
    async def test_zip_contains_app_json(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "app_scaffold/app.json" in zf.namelist()

    @pytest.mark.asyncio
    async def test_zip_contains_all_agent_files(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            for agent in sample_scaffold_request.architecture:
                assert f"app_scaffold/agents/{agent.slug}.json" in names

    @pytest.mark.asyncio
    async def test_zip_contains_tool_stub_files(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            assert "app_scaffold/tools/order_api_stub.json" in names

    @pytest.mark.asyncio
    async def test_zip_contains_readme(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "app_scaffold/README.md" in zf.namelist()

    @pytest.mark.asyncio
    async def test_zip_contains_guardrails_placeholder_when_enabled(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "app_scaffold/guardrails/README.md" in zf.namelist()

    @pytest.mark.asyncio
    async def test_all_json_files_are_valid(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io, json
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for name in zf.namelist():
                if name.endswith(".json"):
                    content = zf.read(name)
                    parsed = json.loads(content)
                    assert isinstance(parsed, dict)

    @pytest.mark.asyncio
    async def test_response_has_correct_agent_count(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        assert response.agent_count == len(sample_scaffold_request.architecture)

    @pytest.mark.asyncio
    async def test_response_architecture_summary_contains_agent_names(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        for agent in sample_scaffold_request.architecture:
            assert agent.name in response.architecture_summary
