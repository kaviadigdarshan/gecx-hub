from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AgentContextEntry(BaseModel):
    slug: str
    name: str
    agent_type: str
    role_summary: str
    persona: str = ""
    handles: list[str] = []
    suggested_tools: list[str] = []
    instruction_applied: bool = False
    instruction_char_count: int = 0
    ces_agent_id: str | None = None
    # NEW
    tools: list[str] = []
    toolsets: list[dict[str, Any]] = []
    callback_hooks: list[str] = []
    instruction_path: str = ""


class ToolContextEntry(BaseModel):
    tool_name: str
    display_name: str
    base_url_env_var: str
    auth_type: str
    ces_tool_id: str | None = None


class VariableDeclaration(BaseModel):
    name: str
    type: Literal["STRING", "BOOLEAN", "OBJECT", "ARRAY"]
    default_value: Any = None
    description: str | None = None


class ToolDefinition(BaseModel):
    id: str
    type: Literal["DATASTORE", "OPENAPI"]
    datastore_source: dict[str, str] | None = None
    open_api_url: str | None = None


class ToolsetDefinition(BaseModel):
    id: str
    open_api_url: str
    tool_ids: list[str] = []


class ScaffoldContext(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    scaffold_id: str
    app_display_name: str
    business_domain: str
    channel: str
    company_name: str = ""
    expected_capabilities: list[str] = []
    decomposition_strategy: str = "capability_based"
    root_agent_style: str = "pure_router"
    agents: list[AgentContextEntry] = []
    tool_stubs: list[ToolContextEntry] = []
    environment_vars: list[str] = []
    guardrails_applied: bool = False
    guardrails_industry: str | None = None
    created_at: str
    last_updated_at: str
    generated_zip_filename: str = ""
    # NEW
    variable_declarations: list[VariableDeclaration] = Field(default_factory=list)
    guardrail_names: list[str] = Field(default_factory=list)
    model_settings: dict[str, Any] = Field(
        default_factory=lambda: {"model": "gemini-2.0-flash-001", "temperature": 1.0}
    )
    tool_execution_mode: Literal["PARALLEL", "SEQUENTIAL"] = "PARALLEL"
    language_code: str = "en-US"
    time_zone: str = "UTC"
    tools: list[ToolDefinition] = Field(default_factory=list)
    toolsets: list[ToolsetDefinition] = Field(default_factory=list)
