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


class TestBuildCesEnvironmentJson:

    def test_empty_inputs_produce_empty_dicts(self):
        from services.scaffolder_service import build_ces_environment_json
        result = build_ces_environment_json([], [])
        assert result == {"tools": {}, "toolsets": {}}

    def test_datastore_tool_generates_correct_structure(self):
        from services.scaffolder_service import build_ces_environment_json
        tools = [
            {
                "id": "faq_datastore",
                "type": "DATASTORE",
                "datastore_source": {"dataStoreName": "projects/p/locations/l/collections/c/dataStores/faq"},
            }
        ]
        result = build_ces_environment_json(tools, [])
        assert "faq_datastore" in result["tools"]
        entry = result["tools"]["faq_datastore"]
        sources = entry["dataStoreTool"]["engineSource"]["dataStoreSources"]
        assert sources[0]["dataStore"]["name"] == "projects/p/locations/l/collections/c/dataStores/faq"

    def test_openapi_toolset_generates_correct_structure(self):
        from services.scaffolder_service import build_ces_environment_json
        toolsets = [
            {"id": "cancel_order", "open_api_url": "https://api.example.com/openapi.json", "tool_ids": ["t1"]}
        ]
        result = build_ces_environment_json([], toolsets)
        assert "cancel_order" in result["toolsets"]
        assert result["toolsets"]["cancel_order"]["openApiToolset"]["url"] == "https://api.example.com/openapi.json"

    def test_multiple_toolsets_all_present(self):
        from services.scaffolder_service import build_ces_environment_json
        toolsets = [
            {"id": "ts1", "open_api_url": "https://a.example.com/spec.json", "tool_ids": []},
            {"id": "ts2", "open_api_url": "https://b.example.com/spec.json", "tool_ids": []},
        ]
        result = build_ces_environment_json([], toolsets)
        assert "ts1" in result["toolsets"]
        assert "ts2" in result["toolsets"]

    def test_tools_key_always_present(self):
        from services.scaffolder_service import build_ces_environment_json
        result = build_ces_environment_json([], [{"id": "ts1", "open_api_url": "https://x.com", "tool_ids": []}])
        assert "tools" in result

    def test_toolsets_key_always_present(self):
        from services.scaffolder_service import build_ces_environment_json
        result = build_ces_environment_json([{"id": "t1", "type": "DATASTORE", "datastore_source": {"dataStoreName": "ds"}}], [])
        assert "toolsets" in result

    def test_tool_without_id_is_skipped(self):
        from services.scaffolder_service import build_ces_environment_json
        result = build_ces_environment_json([{"id": "", "type": "DATASTORE", "datastore_source": {}}], [])
        assert result["tools"] == {}

    def test_toolset_without_id_is_skipped(self):
        from services.scaffolder_service import build_ces_environment_json
        result = build_ces_environment_json([], [{"id": "", "open_api_url": "https://x.com", "tool_ids": []}])
        assert result["toolsets"] == {}


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

    def test_language_settings_set(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert result["languageSettings"]["defaultLanguageCode"] == "en-US"

    def test_time_zone_settings_set(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert result["timeZoneSettings"]["timeZone"] == "UTC"

    def test_model_settings_present(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert "model" in result["modelSettings"]
        assert "temperature" in result["modelSettings"]

    def test_tool_execution_mode_sequential(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert result["toolExecutionMode"] == "SEQUENTIAL"

    def test_tool_execution_mode_parallel(self, sample_use_case):
        from services.scaffolder_service import build_app_json
        from models.accelerators.scaffolder import GlobalSettings
        settings = GlobalSettings(app_display_name="Test", execution_mode="parallel")
        result = build_app_json(settings, sample_use_case.model_dump(), "")
        assert result["toolExecutionMode"] == "PARALLEL"

    def test_guardrails_is_list(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert isinstance(result["guardrails"], list)

    def test_guardrails_contains_names_when_set(self, sample_use_case):
        from services.scaffolder_service import build_app_json
        from models.accelerators.scaffolder import GlobalSettings
        settings = GlobalSettings(
            app_display_name="Test",
            guardrail_names=["content-filter-v1", "prompt-security-v1"],
        )
        result = build_app_json(settings, sample_use_case.model_dump(), "")
        assert result["guardrails"] == ["content-filter-v1", "prompt-security-v1"]

    def test_variable_declarations_is_list(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert isinstance(result["variableDeclarations"], list)

    def test_stub_config_fields_present(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        for field in ("audioProcessingConfig", "dataStoreSettings", "errorHandlingSettings", "defaultChannelProfile"):
            assert field in result, f"Missing stub field: {field}"
            assert result[field] == {}

    def test_description_contains_domain(self, sample_global_settings, sample_use_case):
        from services.scaffolder_service import build_app_json
        result = build_app_json(sample_global_settings, sample_use_case.model_dump(), "")
        assert "retail" in result["description"]


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

    def test_sub_agents_start_empty(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        for agent in sample_agents:
            result = build_agent_json(agent, "instruction")
            assert result["subAgents"] == []

    def test_tools_reflects_agent_tools(self):
        from services.scaffolder_service import build_agent_json
        from models.accelerators.scaffolder import AgentDefinition
        agent = AgentDefinition(
            name="Order Agent", slug="order_agent", agent_type="sub_agent",
            role_summary="Handles orders", handles=[], suggested_tools=[],
            tools=["faq_tool", "order_api"],
        )
        result = build_agent_json(agent, "instruction")
        assert result["tools"] == ["faq_tool", "order_api"]

    def test_toolsets_reflects_agent_toolsets(self):
        from services.scaffolder_service import build_agent_json
        from models.accelerators.scaffolder import AgentDefinition
        toolsets = [{"toolset": "cancel_order", "toolIds": ["cancel_tool"]}]
        agent = AgentDefinition(
            name="Order Agent", slug="order_agent", agent_type="sub_agent",
            role_summary="Handles orders", handles=[], suggested_tools=[],
            toolsets=toolsets,
        )
        result = build_agent_json(agent, "instruction")
        assert result["toolsets"] == toolsets

    def test_all_callback_array_keys_present(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        result = build_agent_json(sample_agents[0], "instruction")
        for key in ("beforeAgentCallbacks", "afterModelCallbacks", "afterToolCallbacks",
                    "beforeModelCallbacks", "afterAgentCallbacks"):
            assert key in result, f"Missing callback key: {key}"

    def test_default_agent_has_before_agent_callback_path(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        # root_agent with no callback_hooks → defaults to ['beforeAgent']
        root = sample_agents[0]
        result = build_agent_json(root, "instruction")
        assert len(result["beforeAgentCallbacks"]) == 1
        assert result["beforeAgentCallbacks"][0]["pythonCode"] == (
            f"agents/{root.slug}/before_agent_callbacks/before_agent_callbacks_01/python_code.py"
        )
        # other hooks should be empty when not in callbackHooks
        assert result["afterModelCallbacks"] == []
        assert result["afterToolCallbacks"] == []
        assert result["beforeModelCallbacks"] == []
        assert result["afterAgentCallbacks"] == []

    def test_before_model_callback_only_for_root_agent(self):
        from services.scaffolder_service import build_agent_json
        from models.accelerators.scaffolder import AgentDefinition
        sub = AgentDefinition(
            name="Sub Agent", slug="sub_agent", agent_type="sub_agent",
            role_summary="Test", handles=[], suggested_tools=[],
            callback_hooks=["beforeAgent", "beforeModel"],
        )
        result = build_agent_json(sub, "instruction")
        # beforeModel silently dropped for sub_agent
        assert result["beforeModelCallbacks"] == []
        assert len(result["beforeAgentCallbacks"]) == 1

    def test_explicit_callback_hooks_generate_correct_paths(self):
        from services.scaffolder_service import build_agent_json
        from models.accelerators.scaffolder import AgentDefinition
        agent = AgentDefinition(
            name="Root Agent", slug="root_agent", agent_type="root_agent",
            role_summary="Routes", handles=[], suggested_tools=[],
            callback_hooks=["beforeAgent", "afterModel", "beforeModel"],
        )
        result = build_agent_json(agent, "instruction")
        assert len(result["beforeAgentCallbacks"]) == 1
        assert len(result["afterModelCallbacks"]) == 1
        assert len(result["beforeModelCallbacks"]) == 1
        assert result["afterToolCallbacks"] == []
        assert result["afterAgentCallbacks"] == []
        # Verify path format
        assert "before_agent_callbacks_01/python_code.py" in result["beforeAgentCallbacks"][0]["pythonCode"]
        assert "after_model_callbacks_01/python_code.py" in result["afterModelCallbacks"][0]["pythonCode"]
        assert "before_model_callbacks_01/python_code.py" in result["beforeModelCallbacks"][0]["pythonCode"]

    def test_instruction_uri_points_to_correct_path(self, sample_agents):
        from services.scaffolder_service import build_agent_json
        agent = sample_agents[1]
        result = build_agent_json(agent, "instruction")
        assert result["instructionUri"] == f"agents/{agent.slug}/instruction.txt"

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
                assert f"agents/{agent.slug}/agent.json" in names
                assert f"agents/{agent.slug}/instruction.txt" in names

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

    @pytest.mark.asyncio
    async def test_zip_contains_ces_environment_json(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "environment.json" in zf.namelist()

    @pytest.mark.asyncio
    async def test_ces_environment_json_has_tools_and_toolsets_keys(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io, json
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            content = json.loads(zf.read("environment.json"))
        assert "tools" in content
        assert "toolsets" in content

    @pytest.mark.asyncio
    async def test_ces_environment_json_empty_when_no_context_tools(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io, json
        # sample_scaffold_request has no context_tools/context_toolsets
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, response = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            content = json.loads(zf.read("environment.json"))
        assert content["tools"] == {}
        assert content["toolsets"] == {}

    @pytest.mark.asyncio
    async def test_zip_contains_before_agent_callback_stubs(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, _ = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            for agent in sample_scaffold_request.architecture:
                stub_path = f"agents/{agent.slug}/before_agent_callbacks/before_agent_callbacks_01/python_code.py"
                assert stub_path in names, f"Missing stub: {stub_path}"

    @pytest.mark.asyncio
    async def test_callback_stub_has_correct_function_signature(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, _ = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        root = next(a for a in sample_scaffold_request.architecture if a.agent_type == "root_agent")
        stub_path = f"agents/{root.slug}/before_agent_callbacks/before_agent_callbacks_01/python_code.py"
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            content = zf.read(stub_path).decode()
        assert "def before_agent_callback(callback_context: CallbackContext)" in content
        assert "Optional[Content]" in content

    @pytest.mark.asyncio
    async def test_agent_json_callback_arrays_reference_stub_paths(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io, json
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, _ = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        root = next(a for a in sample_scaffold_request.architecture if a.agent_type == "root_agent")
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            agent_data = json.loads(zf.read(f"agents/{root.slug}/agent.json"))
        before_agent = agent_data["beforeAgentCallbacks"]
        assert len(before_agent) == 1
        assert before_agent[0]["pythonCode"] == (
            f"agents/{root.slug}/before_agent_callbacks/before_agent_callbacks_01/python_code.py"
        )

    @pytest.mark.asyncio
    async def test_before_model_stub_not_generated_for_sub_agents(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io, json
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, _ = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            agent_jsons = {
                a.slug: json.loads(zf.read(f"agents/{a.slug}/agent.json"))
                for a in sample_scaffold_request.architecture
            }
        for agent in sample_scaffold_request.architecture:
            if agent.agent_type == "sub_agent":
                stub_path = f"agents/{agent.slug}/before_model_callbacks/before_model_callbacks_01/python_code.py"
                assert stub_path not in names, f"beforeModel stub should not exist for sub_agent {agent.slug}"
                assert agent_jsons[agent.slug]["beforeModelCallbacks"] == []

    @pytest.mark.asyncio
    async def test_zip_contains_evaluation_directories(self, sample_scaffold_request):
        from services.scaffolder_service import build_scaffold_zip
        import zipfile, io
        instruction_scaffolds = {a.slug: "<role>Test</role>" for a in sample_scaffold_request.architecture}
        zip_bytes, _ = await build_scaffold_zip(sample_scaffold_request, instruction_scaffolds)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
        assert "evaluationDatasets/.gitkeep" in names
        assert "evaluations/.gitkeep" in names

    @pytest.mark.asyncio
    async def test_ces_environment_json_populated_when_context_tools_set(self):
        from services.scaffolder_service import build_scaffold_zip
        from models.accelerators.scaffolder import (
            AppScaffoldRequest, AgentDefinition, GlobalSettings, UseCaseInput,
        )
        import zipfile, io, json
        settings = GlobalSettings(
            app_display_name="Test App",
            context_tools=[
                {
                    "id": "faq_tool",
                    "type": "DATASTORE",
                    "datastore_source": {"dataStoreName": "projects/p/locations/l/dataStores/faq"},
                }
            ],
            context_toolsets=[
                {"id": "orders_toolset", "open_api_url": "https://api.example.com/spec.json", "tool_ids": []}
            ],
        )
        req = AppScaffoldRequest(
            use_case=UseCaseInput(business_domain="retail", primary_use_case="Test", channel="web_chat"),
            architecture=[AgentDefinition(name="Root", slug="root_agent", agent_type="root_agent",
                                          role_summary="Routes", handles=[], suggested_tools=[])],
            global_settings=settings,
        )
        zip_bytes, _ = await build_scaffold_zip(req, {"root_agent": "<role>R</role>"})
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            content = json.loads(zf.read("environment.json"))
        assert "faq_tool" in content["tools"]
        assert "orders_toolset" in content["toolsets"]
        assert content["toolsets"]["orders_toolset"]["openApiToolset"]["url"] == "https://api.example.com/spec.json"
