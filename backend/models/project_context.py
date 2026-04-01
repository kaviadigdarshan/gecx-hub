from pydantic import BaseModel


class AgentContextEntry(BaseModel):
    slug: str
    name: str
    agent_type: str
    role_summary: str
    handles: list[str] = []
    suggested_tools: list[str] = []
    instruction_applied: bool = False
    instruction_char_count: int = 0
    ces_agent_id: str | None = None


class ToolContextEntry(BaseModel):
    tool_name: str
    display_name: str
    base_url_env_var: str
    auth_type: str
    ces_tool_id: str | None = None


class ScaffoldContext(BaseModel):
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
