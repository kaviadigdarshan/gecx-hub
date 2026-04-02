"""Pydantic models for the Agent Instruction Architect accelerator."""

from typing import Literal

from pydantic import BaseModel, field_validator


# ── Session variable model ─────────────────────────────────────────────────────

class VariableDeclaration(BaseModel):
    name: str   # e.g. "IS_LOGGED_IN", "SHOPPER_ID" — uppercase, matches {VARNAME} CES syntax
    type: Literal["STRING", "BOOLEAN", "NUMBER", "SESSION_PARAMETER"] = "STRING"


# ── Task module models ─────────────────────────────────────────────────────────

class TaskModuleEntry(BaseModel):
    name: str        # camelCase, e.g. "checkLoginStatus"
    trigger: str     # condition text, may contain {VAR_NAME} references
    action: str      # action text, may contain {VAR_NAME} and {@TOOL: name}


class GenerateTaskModulesRequest(BaseModel):
    agent_type: Literal["root_agent", "sub_agent", "specialist_sub_agent"]
    role_summary: str
    variable_names: list[str] = []   # session variable names, e.g. ["IS_LOGGED_IN"]
    tool_names: list[str] = []       # assigned tool names, e.g. ["order_api"]


class GenerateTaskModulesResponse(BaseModel):
    task_modules: list[TaskModuleEntry]
    demo_mode: bool = False


# ── Section input models ───────────────────────────────────────────────────────

class AgentIdentityInput(BaseModel):
    agent_name: str
    agent_purpose: str           # one sentence, max 300 chars — used as AI generation seed
    agent_type: Literal["root_agent", "sub_agent", "specialist_sub_agent"]
    parent_agent_context: str = ""  # only relevant if sub_agent — what parent does

    @field_validator("agent_purpose")
    @classmethod
    def limit_purpose(cls, v: str) -> str:
        return v.strip()[:300]


class PersonaInput(BaseModel):
    persona_name: str = ""      # optional persona name, e.g. "Aria"
    tone: Literal["professional", "friendly_professional", "warm", "concise", "empathetic"]
    brand_voice_keywords: list[str] = []   # e.g. ["confident", "approachable", "clear"]
    language: str = "en-US"
    company_name: str = ""

    @field_validator("brand_voice_keywords")
    @classmethod
    def limit_keywords(cls, v: list[str]) -> list[str]:
        return [k.strip() for k in v if k.strip()][:10]


class ScopeInput(BaseModel):
    primary_goals: list[str]          # what the agent must achieve, 1-10 items
    out_of_scope_topics: list[str]    # what to deflect, 1-10 items
    escalation_triggers: list[str]    # conditions for handoff, 1-5 items
    escalation_target: str = "human agent"   # who/what to escalate to

    @field_validator("primary_goals", "out_of_scope_topics", "escalation_triggers")
    @classmethod
    def clean_list(cls, v: list[str]) -> list[str]:
        return [item.strip() for item in v if item.strip()]


class ToolReferenceInput(BaseModel):
    tool_name: str
    tool_description: str    # what this tool does
    when_to_use: str         # plain English — when should agent call this tool


class ToolsInput(BaseModel):
    tools: list[ToolReferenceInput] = []   # max 10


class SubAgentReferenceInput(BaseModel):
    agent_name: str           # the {@AGENT: name} reference name
    agent_capability: str     # what this sub-agent does
    delegation_condition: str  # when to delegate to this sub-agent


class SubAgentsInput(BaseModel):
    sub_agents: list[SubAgentReferenceInput] = []   # max 10


class ErrorHandlingInput(BaseModel):
    no_answer_response: str = ""      # what to say if no information found
    tool_failure_response: str = ""   # what to say when a tool call fails
    max_clarification_attempts: int = 2   # how many times to ask for clarification
    fallback_behavior: Literal[
        "apologize_and_escalate",
        "apologize_and_retry",
        "apologize_and_end",
    ] = "apologize_and_escalate"


# ── Section generation request/response ───────────────────────────────────────

class CommunicationGuidelinesInput(BaseModel):
    vertical: str                   # e.g. "retail", "bfsi", "healthcare"
    language_code: str = "en-US"    # BCP-47 language code from ScaffoldContext


class SectionType(str):
    PERSONA = "persona"
    SCOPE = "scope"
    TOOLS = "tools"
    SUB_AGENTS = "sub_agents"
    ERROR_HANDLING = "error_handling"
    COMMUNICATION_GUIDELINES = "communication_guidelines"


class GenerateSectionRequest(BaseModel):
    section: Literal["persona", "scope", "tools", "sub_agents", "error_handling", "communication_guidelines"]
    identity: AgentIdentityInput              # always required — seeds all generation
    persona: PersonaInput | None = None       # required for: persona, scope
    scope: ScopeInput | None = None           # required for: scope, tools
    tools: ToolsInput | None = None           # required for: tools
    sub_agents: SubAgentsInput | None = None  # required for: sub_agents
    error_handling: ErrorHandlingInput | None = None  # required for: error_handling
    communication_guidelines: CommunicationGuidelinesInput | None = None  # required for: communication_guidelines
    variable_declarations: list[VariableDeclaration] = []  # session variables from ScaffoldContext


class GenerateSectionResponse(BaseModel):
    section: str
    generated_xml: str          # the XML-tagged section text
    token_count_estimate: int   # rough chars/4


# ── Full assembly request/response ─────────────────────────────────────────────

class AssembleInstructionRequest(BaseModel):
    identity: AgentIdentityInput
    persona: PersonaInput
    scope: ScopeInput
    tools: ToolsInput
    sub_agents: SubAgentsInput
    error_handling: ErrorHandlingInput
    # Optional: user-edited section texts (override AI-generated)
    custom_sections: dict[str, str] = {}   # section name -> custom XML text
    # Optional: task modules to embed after <constraints>/<error_handling>
    task_modules: list[TaskModuleEntry] = []
    # Session variables from ScaffoldContext.variableDeclarations
    variable_declarations: list[VariableDeclaration] = []
    # Slug of the root agent — used to build out-of-scope routing constraint in sub-agents
    root_agent_slug: str = ""


class QualityCheck(BaseModel):
    dimension: str
    passed: bool
    message: str
    severity: Literal["error", "warning", "info"] = "warning"


class AssembleInstructionResponse(BaseModel):
    instruction: str              # the full assembled instruction string
    global_instruction: str       # suggested App-level global_instruction
    quality_score: int            # 0-100
    quality_checks: list[QualityCheck]
    character_count: int
    estimated_tokens: int
    section_breakdown: dict[str, int]   # section name -> character count
    task_modules: list[TaskModuleEntry] = []  # generated <task_module> blocks
    variable_warnings: list[str] = []   # undeclared {VARNAME} references found in the instruction


# ── Push to agent ──────────────────────────────────────────────────────────────

class PushInstructionRequest(BaseModel):
    project_id: str
    location: str = "us-central1"
    app_id: str
    agent_id: str               # short agent ID (not full resource name)
    instruction: str
    create_version_first: bool = True


class PushInstructionResponse(BaseModel):
    success: bool
    agent_name: str
    version_id: str | None
    previous_instruction_preview: str   # first 200 chars of old instruction
    applied_instruction_preview: str    # first 200 chars of new instruction
