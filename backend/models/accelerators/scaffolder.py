"""Pydantic models for the Multi-Agent App Scaffolder accelerator."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


# ── Use case definition ───────────────────────────────────────────────────────

CAPABILITY_OPTIONS = [
    "returns_refunds",
    "order_management",
    "account_management",
    "product_recommendations",
    "payment_support",
    "appointment_booking",
    "technical_support",
    "loyalty_rewards",
    "escalation_to_human",
    "faq_knowledge",
    "inventory_lookup",
    "shipment_tracking",
]


class UseCaseInput(BaseModel):
    business_domain: Literal[
        "retail", "bfsi", "healthcare", "telecom",
        "hospitality", "ecommerce", "utilities", "generic"
    ]
    primary_use_case: str       # free-text description, max 500 chars
    channel: Literal["web_chat", "voice", "both"]
    company_name: str = ""
    expected_capabilities: list[str] = []  # subset of CAPABILITY_OPTIONS

    @field_validator("primary_use_case")
    @classmethod
    def limit_description(cls, v: str) -> str:
        return v.strip()[:500]

    @field_validator("expected_capabilities")
    @classmethod
    def validate_capabilities(cls, v: list[str]) -> list[str]:
        return [c for c in v if c in CAPABILITY_OPTIONS]


# ── Architecture definition ───────────────────────────────────────────────────

class AgentDefinition(BaseModel):
    name: str                   # display name, e.g. "Order Support Agent"
    slug: str                   # file-safe name, e.g. "order_support_agent"
    agent_type: Literal["root_agent", "sub_agent"]
    role_summary: str           # one sentence: what this agent handles
    handles: list[str]          # list of capability slugs this agent owns
    suggested_tools: list[str]  # tool names suggested for this agent
    ai_generated: bool = True   # False if user manually added/edited
    tools: list[str] = []       # tool IDs assigned to this agent
    toolsets: list[dict] = []   # [{'toolset': '<id>', 'toolIds': [...]}]
    callback_hooks: list[str] = []  # e.g. ['beforeAgent', 'afterModel', 'afterTool', 'beforeModel', 'afterAgent']

    @field_validator("slug")
    @classmethod
    def make_slug(cls, v: str) -> str:
        return re.sub(r"[^a-z0-9_]", "_", v.lower().strip())


class ArchitectureSuggestion(BaseModel):
    agents: list[AgentDefinition]
    rationale: str              # Gemini's explanation of why this topology
    decomposition_strategy: str # "capability_based" | "channel_based" | "hybrid"
    root_agent_style: str       # "pure_router" | "hybrid"
    estimated_complexity: Literal["simple", "moderate", "complex"]


class ArchitectureSuggestRequest(BaseModel):
    use_case: UseCaseInput


# ── Tool configuration ────────────────────────────────────────────────────────

class ToolStubConfig(BaseModel):
    tool_name: str              # slug, e.g. "backend_api"
    display_name: str           # e.g. "Backend API"
    description: str            # what it does
    base_url_env_var: str       # e.g. "BACKEND_API_BASE_URL"
    auth_type: Literal["api_key", "oauth", "none"] = "api_key"
    assigned_to_agents: list[str] = []  # agent slugs


# ── Global settings ───────────────────────────────────────────────────────────

class GlobalSettings(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    app_display_name: str
    default_language: str = "en-US"
    time_zone: str = "UTC"
    logging_enabled: bool = True
    execution_mode: Literal["parallel", "sequential"] = "sequential"
    global_instruction_keywords: str = ""  # brand tone keywords for global_instruction
    model_name: str = "gemini-2.0-flash-001"
    model_temperature: float = 1.0
    guardrail_names: list[str] = []
    variable_declarations: list[dict] = []
    context_tools: list[dict] = []       # ToolDefinition objects from ScaffoldContext
    context_toolsets: list[dict] = []    # ToolsetDefinition objects from ScaffoldContext


# ── Main generate request ─────────────────────────────────────────────────────

class AppScaffoldRequest(BaseModel):
    use_case: UseCaseInput
    architecture: list[AgentDefinition]      # may be user-edited from suggestion
    tool_stubs: list[ToolStubConfig] = []
    global_settings: GlobalSettings
    include_guardrails_placeholder: bool = True
    include_examples_placeholder: bool = True

    @field_validator("architecture")
    @classmethod
    def must_have_root_agent(cls, v: list[AgentDefinition]) -> list[AgentDefinition]:
        root_agents = [a for a in v if a.agent_type == "root_agent"]
        if len(root_agents) == 0:
            raise ValueError("Architecture must include exactly one root agent")
        if len(root_agents) > 1:
            raise ValueError("Architecture must include exactly one root agent")
        return v


# ── Scaffold output ───────────────────────────────────────────────────────────

class AgentScaffoldPreview(BaseModel):
    agent_slug: str
    display_name: str
    agent_type: str
    instruction_scaffold: str   # scaffolded instruction string (XML tags, placeholder content)
    json_resource: dict         # full agent JSON for the ZIP


class ToolStubPreview(BaseModel):
    tool_name: str
    display_name: str
    json_resource: dict


class AppScaffoldResponse(BaseModel):
    request_id: str
    download_url: str
    zip_filename: str
    app_display_name: str
    agent_count: int
    tool_stub_count: int
    agent_previews: list[AgentScaffoldPreview]
    tool_previews: list[ToolStubPreview]
    environment_vars: list[str]    # list of $env_var names in the ZIP
    architecture_summary: str      # ASCII tree diagram as a string
    generation_timestamp: str


# ── Import response ───────────────────────────────────────────────────────────

class ImportScaffoldRequest(BaseModel):
    project_id: str
    location: str = "us-central1"
    zip_base64: str             # base64-encoded ZIP bytes
    app_display_name: str


class ImportScaffoldResponse(BaseModel):
    success: bool
    app_name: str               # full resource name
    app_id: str                 # short ID
    app_console_url: str        # link to CES console


# ── Regenerate request/response ───────────────────────────────────────────────

class RegenerateScaffoldRequest(BaseModel):
    scaffold_context_id: str    # scaffold UUID = scaffoldContext.scaffoldId


class RegenerateScaffoldResponse(BaseModel):
    download_url: str
    guardrail_count: int


# ── Session variable suggestion request/response ──────────────────────────────

class SuggestVariablesRequest(BaseModel):
    vertical: str
    agents: list[dict] = []     # AgentDefinition dicts (name, slug, agent_type, …)


class VariableSuggestion(BaseModel):
    name: str
    type: Literal["STRING", "BOOLEAN", "OBJECT", "ARRAY"]
    default_value: object = None
    description: str = ""


class SuggestVariablesResponse(BaseModel):
    suggestions: list[VariableSuggestion]
