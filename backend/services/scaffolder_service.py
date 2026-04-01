"""Scaffold builder: assembles the AppSnapshot ZIP for the Multi-Agent App Scaffolder."""

import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from models.accelerators.scaffolder import (
    AgentDefinition,
    AgentScaffoldPreview,
    AppScaffoldRequest,
    AppScaffoldResponse,
    GlobalSettings,
    ToolStubConfig,
    ToolStubPreview,
)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "scaffolder"


# ── Environment.json builder ──────────────────────────────────────────────────

def build_environment_json(
    tool_stubs: list[ToolStubConfig],
    global_settings: GlobalSettings,
    use_case: dict,
) -> dict:
    """Build the environment.json manifest with $env_var placeholders.

    Collects all env vars from tool stubs plus standard GCP vars.
    API-key-authed tools also get a corresponding secret var.
    """
    env_vars: dict[str, str] = {
        "GCP_PROJECT_ID": "$GCP_PROJECT_ID",
        "GCP_LOCATION": "$GCP_LOCATION",
    }

    for tool in tool_stubs:
        env_var_name = tool.base_url_env_var.upper().replace("-", "_")
        env_vars[env_var_name] = f"${env_var_name}"
        if tool.auth_type == "api_key":
            secret_var = f"{env_var_name.replace('_URL', '')}_API_KEY_SECRET"
            env_vars[secret_var] = f"${secret_var}"

    return {
        "name": "environment",
        "envVars": env_vars,
    }


# ── App.json builder ──────────────────────────────────────────────────────────

def build_app_json(
    global_settings: GlobalSettings,
    use_case: dict,
    global_instruction: str,
) -> dict:
    """Build the top-level App resource JSON."""
    return {
        "displayName": global_settings.app_display_name,
        "globalInstruction": global_instruction,
        "agentEngineConfig": {
            "executionConfig": {
                "streamingMode": "SERVER_SIDE_STREAMING",
                "parallelToolCalls": global_settings.execution_mode == "parallel",
            }
        },
        "loggingConfig": {
            "enabled": global_settings.logging_enabled,
            "enableStackdriverLogging": global_settings.logging_enabled,
        },
        "languageCode": global_settings.default_language,
    }


def build_global_instruction(global_settings: GlobalSettings, use_case: dict) -> str:
    """Build a placeholder global_instruction string.

    Intentionally simple — the real global_instruction is refined via
    Accelerator 2 (Instruction Architect).
    """
    company = use_case.get("company_name") or "our company"
    keywords = global_settings.global_instruction_keywords or "professional and helpful"

    return (
        f"You are a customer service AI agent representing {company}. "
        f"Always maintain a {keywords} tone in all interactions. "
        f"Never claim to be human. Identify yourself as an AI assistant when asked. "
        f"[CONFIGURE: Add company-wide behavioral rules, compliance requirements, and "
        f"brand guidelines here. Use Accelerator 2 (Instruction Architect) to generate "
        f"refined instructions.]"
    )


# ── Agent.json builder ────────────────────────────────────────────────────────

def build_agent_json(
    agent: AgentDefinition,
    instruction_scaffold: str,
) -> dict:
    """Build a single agent resource JSON.

    ``tools`` and ``subAgents`` are left empty — they are configured in the CES
    console after import (or via PATCH through Acc 2).
    """
    return {
        "displayName": agent.name,
        "instruction": instruction_scaffold,
        "tools": [],
        "subAgents": [],
        "_gecxhub_metadata": {
            "generated_by": "GECX Accelerator Hub — Multi-Agent App Scaffolder",
            "agent_type": agent.agent_type,
            "handles": agent.handles,
            "suggested_tools": agent.suggested_tools,
            "configure_note": (
                "After import, use the CES console to connect tools and sub-agent "
                "references. Use Accelerator 2 (Instruction Architect) to refine the "
                "instruction. Use Accelerator 6 (Tool Builder) to create and connect tools."
            ),
        },
    }


# ── Tool stub builder ─────────────────────────────────────────────────────────

def build_tool_stub_json(tool: ToolStubConfig) -> dict:
    """Build an OpenAPI tool stub JSON.

    The server URL uses $env_var syntax for environment-promotion compatibility.
    """
    env_var = tool.base_url_env_var.upper().replace("-", "_")

    openapi_spec = {
        "openapi": "3.0.0",
        "info": {
            "title": tool.display_name,
            "version": "1.0.0",
            "description": tool.description,
        },
        "servers": [{"url": f"${env_var}"}],
        "paths": {
            "/stub": {
                "get": {
                    "operationId": f"{tool.tool_name}_stub",
                    "summary": "Stub endpoint — replace with actual API spec",
                    "parameters": [],
                    "responses": {"200": {"description": "Success"}},
                }
            }
        },
    }

    stub: dict = {
        "displayName": tool.display_name,
        "description": (
            tool.description
            + " [CONFIGURE: Replace with actual OpenAPI spec or use Accelerator 6 (Tool Builder)]"
        ),
        "openApiSpec": {"text": json.dumps(openapi_spec, indent=2)},
    }

    if tool.auth_type == "api_key":
        secret_name = tool.tool_name.replace("_", "-")
        stub["authConfig"] = {
            "apiKeyConfig": {
                "name": "x-api-key",
                "in": "HEADER",
                "secretVersionName": (
                    f"projects/$GCP_PROJECT_ID/secrets/{secret_name}-key/versions/latest"
                ),
            }
        }
    elif tool.auth_type == "oauth":
        stub["authConfig"] = {
            "oauthConfig": {
                "[CONFIGURE]": "Add OAuth 2.0 client credentials configuration"
            }
        }

    return stub


# ── ASCII architecture diagram ────────────────────────────────────────────────

def build_ascii_diagram(agents: list[AgentDefinition]) -> str:
    """Build an ASCII tree diagram of the agent topology.

    Example output::

        [ROOT] Root Agent
          ├── [SUB] Order Support Agent
          │        handles: order_management, returns_refunds
          └── [SUB] FAQ Agent
                   handles: faq_knowledge, loyalty_rewards
    """
    root = next((a for a in agents if a.agent_type == "root_agent"), None)
    if not root:
        return "(no root agent)"

    sub_agents = [a for a in agents if a.agent_type == "sub_agent"]

    lines = [f"[ROOT] {root.name}"]
    for i, sub in enumerate(sub_agents):
        is_last = i == len(sub_agents) - 1
        connector = "└──" if is_last else "├──"
        handles_str = ", ".join(sub.handles[:3])
        if len(sub.handles) > 3:
            handles_str += f" +{len(sub.handles) - 3} more"
        lines.append(f"  {connector} [SUB] {sub.name}")
        if handles_str:
            spacer = "     " if is_last else "  │  "
            lines.append(f"  {spacer}     handles: {handles_str}")

    return "\n".join(lines)


# ── README builder ────────────────────────────────────────────────────────────

def build_readme(
    request: AppScaffoldRequest,
    ascii_diagram: str,
    env_vars: list[str],
) -> str:
    company = request.use_case.company_name or "your company"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    env_vars_list = "\n".join(f"  - {v}" for v in env_vars)

    agent_details = "\n".join(
        f"**{a.name}** ({a.agent_type})\n"
        f"  {a.role_summary}\n"
        f"  Handles: {', '.join(a.handles)}"
        for a in request.architecture
    )

    return (
        f"# {request.global_settings.app_display_name} — CX Agent Studio Scaffold\n\n"
        f"Generated by GECX Accelerator Hub — Multi-Agent App Scaffolder\n"
        f"Domain: {request.use_case.business_domain.title()} | "
        f"Channel: {request.use_case.channel} | Generated: {timestamp}\n\n"
        f"## Agent Topology\n\n"
        f"{ascii_diagram}\n\n"
        f"## How to Import This Scaffold\n\n"
        f"### Step 1: Fill in environment variables\n"
        f"Edit `environment.json` and replace all $ENV_VAR placeholders with actual values.\n"
        f"Variables required:\n"
        f"{env_vars_list}\n\n"
        f"### Step 2: Import to CX Agent Studio\n"
        f"Option A — CES Console:\n"
        f"  1. Open ces.cloud.google.com\n"
        f"  2. Navigate to your App or create a new one\n"
        f"  3. Use the import function and upload this ZIP file\n\n"
        f"Option B — CES REST API:\n"
        f"  POST https://ces.googleapis.com/v1/projects/{{PROJECT}}/locations/{{LOCATION}}/apps:importApp\n"
        f"  Authorization: Bearer YOUR_ACCESS_TOKEN\n"
        f"  Content-Type: application/json\n"
        f"  Body: {{\n"
        f'    "appSnapshot": {{\n'
        f'      "agentEngineSnapshot": "BASE64_ENCODED_ZIP"\n'
        f"    }}\n"
        f"  }}\n\n"
        f"Option C — GECX Accelerator Hub:\n"
        f"  Use the \"Import to App\" button in the Accelerator Hub interface.\n\n"
        f"### Step 3: Configure instructions\n"
        f"Each agent's instruction contains [CONFIGURE: ...] markers.\n"
        f"Use Accelerator 2 (Agent Instruction Architect) in the GECX Hub to refine each instruction.\n\n"
        f"### Step 4: Connect tools\n"
        f"Tool stubs in tools/ are placeholders. Use Accelerator 4 (OpenAPI Tool Builder)\n"
        f"to create proper tool definitions from your actual API specs.\n\n"
        f"### Step 5: Apply guardrails\n"
        f"The guardrails/ directory is empty. Use Accelerator 1 (Guardrails Generator)\n"
        f"to generate and apply appropriate guardrails.\n\n"
        f"### Step 6: Add few-shot examples\n"
        f"The examples/ directory is empty. Use Accelerator 5 (Few-Shot Examples Factory)\n"
        f"to create examples for each agent.\n\n"
        f"## What Each Agent Handles\n\n"
        f"{agent_details}\n"
    )


# ── Master ZIP builder ────────────────────────────────────────────────────────

async def build_scaffold_zip(
    request: AppScaffoldRequest,
    instruction_scaffolds: dict[str, str],
) -> tuple[bytes, AppScaffoldResponse]:
    """Assemble the complete AppSnapshot ZIP in memory.

    Returns ``(zip_bytes, response_object)``. The ``download_url`` field on
    the response is left empty — the router fills it in after uploading
    ``zip_bytes`` to GCS.
    """
    request_id = str(uuid.uuid4())

    global_instruction = build_global_instruction(
        request.global_settings, request.use_case.model_dump()
    )
    env_json = build_environment_json(
        request.tool_stubs, request.global_settings, request.use_case.model_dump()
    )
    app_json = build_app_json(
        request.global_settings, request.use_case.model_dump(), global_instruction
    )

    agent_previews: list[AgentScaffoldPreview] = []
    tool_previews: list[ToolStubPreview] = []

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:

        zf.writestr("app_scaffold/environment.json", json.dumps(env_json, indent=2))
        zf.writestr("app_scaffold/app.json", json.dumps(app_json, indent=2))

        for agent in request.architecture:
            instruction = instruction_scaffolds.get(agent.slug, "")
            agent_json = build_agent_json(agent, instruction)
            zf.writestr(
                f"app_scaffold/agents/{agent.slug}.json",
                json.dumps(agent_json, indent=2),
            )
            agent_previews.append(
                AgentScaffoldPreview(
                    agent_slug=agent.slug,
                    display_name=agent.name,
                    agent_type=agent.agent_type,
                    instruction_scaffold=instruction,
                    json_resource=agent_json,
                )
            )

        for tool in request.tool_stubs:
            tool_json = build_tool_stub_json(tool)
            zf.writestr(
                f"app_scaffold/tools/{tool.tool_name}_stub.json",
                json.dumps(tool_json, indent=2),
            )
            tool_previews.append(
                ToolStubPreview(
                    tool_name=tool.tool_name,
                    display_name=tool.display_name,
                    json_resource=tool_json,
                )
            )

        if request.include_guardrails_placeholder:
            zf.writestr(
                "app_scaffold/guardrails/README.md",
                "# Guardrails\n\nThis directory is empty.\n"
                "Use Accelerator 1 (Guardrails Generator) in GECX Hub to generate "
                "and apply guardrails for this App.\n",
            )

        if request.include_examples_placeholder:
            zf.writestr(
                "app_scaffold/examples/README.md",
                "# Few-Shot Examples\n\nThis directory is empty.\n"
                "Use Accelerator 5 (Few-Shot Examples Factory) in GECX Hub to create "
                "example conversations for each agent.\n",
            )

        ascii_diagram = build_ascii_diagram(request.architecture)
        env_var_names = list(env_json.get("envVars", {}).keys())
        readme = build_readme(request, ascii_diagram, env_var_names)
        zf.writestr("app_scaffold/README.md", readme)

    buffer.seek(0)
    zip_bytes = buffer.read()

    app_name = request.global_settings.app_display_name
    zip_filename = (
        f"{app_name.lower().replace(' ', '_')}_scaffold_{request_id[:8]}.zip"
    )

    response = AppScaffoldResponse(
        request_id=request_id,
        download_url="",  # filled in by router after GCS upload
        zip_filename=zip_filename,
        app_display_name=app_name,
        agent_count=len(request.architecture),
        tool_stub_count=len(request.tool_stubs),
        agent_previews=agent_previews,
        tool_previews=tool_previews,
        environment_vars=env_var_names,
        architecture_summary=ascii_diagram,
        generation_timestamp=datetime.now(timezone.utc).isoformat(),
    )

    return zip_bytes, response
