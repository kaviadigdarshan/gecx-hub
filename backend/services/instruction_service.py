"""Core service for AI-assisted agent instruction generation and assembly."""

import logging
import os
import re

from fastapi import HTTPException

from models.accelerators.instructions import (
    AssembleInstructionRequest,
    AssembleInstructionResponse,
    GenerateSectionRequest,
    GenerateSectionResponse,
    GenerateTaskModulesRequest,
    GenerateTaskModulesResponse,
    QualityCheck,
    RegenerateTaskRequest,
    RegenerateTaskResponse,
    TaskModuleEntry,
    VariableDeclaration,
)
from services.gemini_service import get_gemini_service
from templates.instructions.section_prompts import (
    SYSTEM_INSTRUCTION_BASE,
    get_communication_guidelines_prompt,
    get_error_handling_prompt,
    get_global_instruction_prompt,
    get_persona_prompt,
    get_scope_prompt,
    get_sub_agents_prompt,
    get_tools_prompt,
)

logger = logging.getLogger(__name__)


# ── Section generation ────────────────────────────────────────────────────────

async def generate_section(request: GenerateSectionRequest) -> GenerateSectionResponse:
    """Call Gemini to generate a single instruction section.

    Routes to the correct prompt builder based on request.section.
    Returns a pre-filled response (no Gemini call) when the relevant
    inputs are empty (no tools, no sub-agents).
    """
    gemini = get_gemini_service()
    identity_dict = request.identity.model_dump()
    session_vars = [v.model_dump() for v in request.variable_declarations]

    if request.section == "persona":
        if request.persona is None:
            raise HTTPException(status_code=422, detail="persona is required for the persona section")
        prompt = get_persona_prompt(identity_dict, request.persona.model_dump())

    elif request.section == "scope":
        if request.persona is None or request.scope is None:
            raise HTTPException(status_code=422, detail="persona and scope are required for the scope section")
        prompt = get_scope_prompt(
            identity_dict,
            request.persona.model_dump(),
            request.scope.model_dump(),
            session_vars=session_vars,
        )

    elif request.section == "tools":
        if request.scope is None or request.tools is None:
            raise HTTPException(status_code=422, detail="scope and tools are required for the tools section")
        prompt = get_tools_prompt(
            identity_dict,
            request.scope.model_dump(),
            [t.model_dump() for t in request.tools.tools],
            session_vars=session_vars,
        )
        if not prompt:
            return GenerateSectionResponse(
                section="tools",
                generated_xml="<!-- No tools configured for this agent -->",
                token_count_estimate=0,
            )

    elif request.section == "sub_agents":
        if request.sub_agents is None:
            raise HTTPException(status_code=422, detail="sub_agents is required for the sub_agents section")
        prompt = get_sub_agents_prompt(
            identity_dict,
            [a.model_dump() for a in request.sub_agents.sub_agents],
            session_vars=session_vars,
        )
        if not prompt:
            return GenerateSectionResponse(
                section="sub_agents",
                generated_xml="<!-- No sub-agents configured -->",
                token_count_estimate=0,
            )

    elif request.section == "error_handling":
        error_dict = request.error_handling.model_dump() if request.error_handling else {}
        prompt = get_error_handling_prompt(identity_dict, error_dict, session_vars=session_vars)

    elif request.section == "communication_guidelines":
        if os.environ.get("ENVIRONMENT") == "demo":
            return GenerateSectionResponse(
                section="communication_guidelines",
                generated_xml=_DEMO_COMMUNICATION_GUIDELINES,
                token_count_estimate=len(_DEMO_COMMUNICATION_GUIDELINES) // 4,
            )
        if request.communication_guidelines is None:
            raise HTTPException(
                status_code=422,
                detail="communication_guidelines is required for the communication_guidelines section",
            )
        prompt = get_communication_guidelines_prompt(
            identity_dict,
            request.communication_guidelines.model_dump(),
        )

    else:
        raise ValueError(f"Unknown section: {request.section}")

    generated = await gemini.generate_with_retry(
        prompt=prompt,
        system_instruction=SYSTEM_INSTRUCTION_BASE,
        temperature=0.4,
        max_output_tokens=1024,
    )

    return GenerateSectionResponse(
        section=request.section,
        generated_xml=generated.strip(),
        token_count_estimate=len(generated) // 4,
    )


# ── Task module generation ─────────────────────────────────────────────────────

_DEMO_COMMUNICATION_GUIDELINES = """\
<communication_guidelines>
  <tone>Maintain a professional yet approachable tone that builds user confidence and trust. Respond with clarity and empathy, keeping interactions focused and efficient.</tone>
  <format>Limit bullet lists to a maximum of 5 items per response. Keep responses concise — aim for 2-4 sentences for simple queries and no more than 150 words for complex ones. Use structured formatting only when it aids comprehension.</format>
  <language>Use formal register with clear, jargon-free language accessible to a general audience. For en-US locale, prefer American English spelling and date formats (MM/DD/YYYY). Avoid colloquialisms and regional idioms.</language>
</communication_guidelines>"""

_DEMO_TASK_MODULES = [
    TaskModuleEntry(
        name="checkLoginStatus",
        trigger="When user mentions their account or orders but {IS_LOGGED_IN} is false",
        action="Prompt user to log in before proceeding. Call {@TOOL: auth_check} if available.",
    ),
    TaskModuleEntry(
        name="confirmBeforeAction",
        trigger="When user requests a destructive or irreversible action",
        action="Ask the user to confirm their intent before proceeding with the action.",
    ),
]


async def generate_task_modules(
    request: GenerateTaskModulesRequest,
) -> GenerateTaskModulesResponse:
    """Generate 2-4 reusable task_module blocks using Gemini.

    Falls back to two hardcoded stub modules in DEMO_MODE or when Gemini fails.
    """
    if os.environ.get("ENVIRONMENT") == "demo":
        return GenerateTaskModulesResponse(task_modules=_DEMO_TASK_MODULES, demo_mode=True)

    variable_list = ", ".join(request.variable_names) if request.variable_names else "none"
    tool_list = ", ".join(request.tool_names) if request.tool_names else "none"

    prompt = (
        f"For a {request.agent_type} CX Agent Studio sub-agent with role: {request.role_summary}. "
        f"The agent has access to these session variables: {variable_list}. "
        f"The agent has access to these tools: {tool_list}. "
        f"Generate 2-4 reusable task_module blocks that capture common conditional patterns. "
        f"Each module must have: name (camelCase), trigger, action. "
        f"Use {{varname}} syntax for session variables in trigger/action. "
        f"Use {{@TOOL: toolname}} syntax for tool references in action. "
        f"Return as JSON array: [{{\"name\": \"...\", \"trigger\": \"...\", \"action\": \"...\"}}]"
    )

    gemini = get_gemini_service()
    try:
        raw = await gemini.generate_structured_json(prompt=prompt, temperature=0.3)
        items = raw if isinstance(raw, list) else raw.get("task_modules", raw.get("modules", []))
        modules: list[TaskModuleEntry] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            trigger = str(item.get("trigger", "")).strip()
            action = str(item.get("action", "")).strip()
            if name and trigger and action:
                modules.append(TaskModuleEntry(name=name, trigger=trigger, action=action))
        if modules:
            return GenerateTaskModulesResponse(task_modules=modules[:4], demo_mode=False)
    except Exception as exc:
        logger.warning("Task module generation via Gemini failed, using demo stubs: %s", exc)

    return GenerateTaskModulesResponse(task_modules=_DEMO_TASK_MODULES, demo_mode=True)


def render_task_modules_xml(modules: list[TaskModuleEntry]) -> str:
    """Render a list of TaskModuleEntry objects as XML blocks."""
    parts = []
    for m in modules:
        parts.append(
            f'<task_module name="{m.name}">\n'
            f"  <trigger>{m.trigger}</trigger>\n"
            f"  <action>{m.action}</action>\n"
            f"</task_module>"
        )
    return "\n\n".join(parts)


# ── Single task module regeneration ───────────────────────────────────────────

async def regenerate_task(request: RegenerateTaskRequest) -> RegenerateTaskResponse:
    """Regenerate a single <task_module> block using Gemini.

    Falls back to a deterministic stub in DEMO_MODE or when Gemini fails.
    """
    if os.environ.get("ENVIRONMENT") == "demo":
        stub = TaskModuleEntry(
            name=request.task_title,
            trigger=f"When user requests action related to {request.task_title.replace('_', ' ')}",
            action=f"Process the {request.task_title.replace('_', ' ')} request and respond appropriately.",
        )
        return RegenerateTaskResponse(
            task_module_xml=render_task_modules_xml([stub]),
            task_module=stub,
            demo_mode=True,
        )

    prompt = (
        f"Rewrite this task module for a {request.vertical} agent named {request.agent_name}. "
        f"Task: {request.task_title}. "
        f"Return only the <task_module>...</task_module> XML block with a name attribute, "
        f"and child elements <trigger> and <action>."
    )

    gemini = get_gemini_service()
    try:
        raw = await gemini.generate_with_retry(
            prompt=prompt,
            system_instruction=SYSTEM_INSTRUCTION_BASE,
            temperature=0.4,
            max_output_tokens=512,
        )
        raw = raw.strip()
        block_match = re.search(r"<task_module([^>]*)>([\s\S]*?)</task_module>", raw)
        if block_match:
            attrs = block_match.group(1)
            body = block_match.group(2)
            name_match = re.search(r'name="([^"]*)"', attrs)
            name = name_match.group(1) if name_match else request.task_title
            trigger_match = re.search(r"<trigger>([\s\S]*?)</trigger>", body)
            action_match = re.search(r"<action>([\s\S]*?)</action>", body)
            entry = TaskModuleEntry(
                name=name,
                trigger=trigger_match.group(1).strip() if trigger_match else body.strip(),
                action=action_match.group(1).strip() if action_match else "",
            )
            return RegenerateTaskResponse(
                task_module_xml=render_task_modules_xml([entry]),
                task_module=entry,
                demo_mode=False,
            )
        logger.warning("regenerate_task: Gemini returned no parseable <task_module> block")
    except Exception as exc:
        logger.warning("regenerate_task: Gemini call failed, using stub: %s", exc)

    stub = TaskModuleEntry(
        name=request.task_title,
        trigger=f"When user requests action related to {request.task_title}",
        action=f"Handle the {request.task_title} request appropriately.",
    )
    return RegenerateTaskResponse(
        task_module_xml=render_task_modules_xml([stub]),
        task_module=stub,
        demo_mode=True,
    )


# ── CES reference injection ────────────────────────────────────────────────────

def inject_ces_references(
    text: str,
    tool_names: list[str],
    agent_names: list[str],
) -> str:
    """Inject {@TOOL: name} and {@AGENT: name} CES reference syntax into instruction text.

    Existing references are preserved (idempotent). Bare name mentions that fall
    on word boundaries are wrapped with the correct CES syntax.

    Args:
        text: The assembled instruction text to post-process.
        tool_names: List of tool IDs available to this agent (from ScaffoldContext).
        agent_names: List of sub-agent names available for delegation.
    """
    if not tool_names and not agent_names:
        return text

    # Stash existing {@TOOL: ...} and {@AGENT: ...} references so they are not
    # double-wrapped when the bare name is later matched inside the instruction.
    existing_refs: list[str] = []

    def _stash(m: re.Match) -> str:
        idx = len(existing_refs)
        existing_refs.append(m.group(0))
        return f"\x00REF{idx}\x00"

    text = re.sub(r"\{@(?:TOOL|AGENT):[^}]+\}", _stash, text)

    for name in tool_names:
        if not name:
            continue
        text = re.sub(r"\b" + re.escape(name) + r"\b", f"{{@TOOL: {name}}}", text)

    for name in agent_names:
        if not name:
            continue
        text = re.sub(r"\b" + re.escape(name) + r"\b", f"{{@AGENT: {name}}}", text)

    # Restore stashed references
    for idx, ref in enumerate(existing_refs):
        text = text.replace(f"\x00REF{idx}\x00", ref)

    return text


# ── Session variable validation ────────────────────────────────────────────────

def validate_variable_references(
    text: str,
    declared_names: set[str],
) -> list[str]:
    """Return warning messages for {VARNAME} references not found in declared_names.

    Matches uppercase CES session variable syntax ({IS_LOGGED_IN}, {SHOPPER_ID})
    but ignores {@TOOL:} and {@AGENT:} references (contain @) and lowercase
    template tokens used internally.

    Warns but never raises — callers decide how to surface warnings.
    """
    refs = re.findall(r"\{([A-Z][A-Z0-9_]*)\}", text)
    seen: set[str] = set()
    warnings: list[str] = []
    for ref in refs:
        if ref not in seen and ref not in declared_names:
            warnings.append(
                f"Variable reference {{{ref}}} used in instruction but not declared in variableDeclarations"
            )
            seen.add(ref)
    return warnings


# ── Constraints section (always deterministic, never AI-generated) ────────────

def build_constraints_section(
    sub_agents: list[dict],
    agent_type: str,
    root_agent_slug: str,
) -> str:
    """Build a <constraints> section with non-removable routing and escalation rules.

    Always appended AFTER any Gemini-generated constraint text.  Two constraints
    are injected for every agent:

    1. Out-of-scope routing — NOT added to root agents, because the root agent
       is the entry point; there is no parent to route back to.
    2. Human escalation — added to ALL agents including root.

    Args:
        sub_agents: List of sub-agent dicts (from SubAgentsInput.sub_agents).
                    Used to emit {@AGENT: name} delegation hints per sub-agent.
        agent_type: "root_agent", "sub_agent", or "specialist_sub_agent".
        root_agent_slug: The slug/name of the root agent — used in the out-of-scope
                         routing constraint for non-root agents.
    """
    lines: list[str] = ["<constraints>"]

    # Per-sub-agent delegation hints (deterministic from SubAgentsInput)
    for sa in sub_agents:
        name = sa.get("agent_name", "").strip()
        condition = sa.get("delegation_condition", "").strip()
        capability = sa.get("agent_capability", "").strip()
        if name:
            hint = condition or capability or f"queries handled by {name}"
            lines.append(
                f"  <constraint>When {hint}, delegate to {{@AGENT: {name}}}.</constraint>"
            )

    # Out-of-scope routing — sub-agents only
    if agent_type != "root_agent" and root_agent_slug:
        lines.append(
            f"  <constraint>Strictly route all out-of-scope queries back to "
            f"{{@AGENT: {root_agent_slug}}}. "
            f"Do not attempt to answer queries outside your defined scope.</constraint>"
        )

    # Human escalation — all agents
    lines.append(
        "  <constraint>When a user confirms they want to speak to a human agent, "
        "immediately call {@AGENT: human_agent_transfer} to escalate.</constraint>"
    )

    lines.append("</constraints>")
    return "\n".join(lines)


# ── Role section (always deterministic, never AI-generated) ───────────────────

def build_role_section_from_identity(
    name: str,
    purpose: str,
    agent_type: str,
    parent_context: str,
) -> str:
    """Build the <role> section deterministically from identity inputs.

    Kept non-AI so the agent's core identity is always consistent and auditable.
    """
    role_lines = [f"You are {name}, {purpose}."]

    if agent_type in ("sub_agent", "specialist_sub_agent") and parent_context:
        role_lines.append(
            f"You operate as a specialist sub-agent. Your parent agent is responsible for: {parent_context}. "
            "You handle specific tasks delegated to you and return control to your parent agent when complete."
        )
    elif agent_type == "root_agent":
        role_lines.append(
            "You are the primary agent that users interact with. You manage the overall conversation "
            "and delegate to specialist sub-agents when appropriate."
        )

    return f"<role>\n{chr(10).join(role_lines)}\n</role>"


# ── Instruction assembly ───────────────────────────────────────────────────────

def assemble_instruction(
    sections: dict[str, str],
    identity_dict: dict,
    task_modules: list[TaskModuleEntry] | None = None,
    tool_names: list[str] | None = None,
    agent_names: list[str] | None = None,
    sub_agents: list[dict] | None = None,
    root_agent_slug: str = "",
) -> str:
    """Assemble the final instruction string from individual XML section texts.

    The <role> section is always auto-built from identity inputs and prepended
    first. Remaining sections follow a fixed order. Empty sections and HTML
    comment placeholders are omitted from the output.

    A <constraints> section is built deterministically after <error_handling>,
    containing per-sub-agent delegation hints, an out-of-scope routing rule
    (non-root agents only), and a mandatory human-escalation rule (all agents).

    task_modules are inserted after <constraints> and before <taskflow>. Each
    module is rendered as a <task_module> XML block.

    After assembly, bare mentions of tool_names and agent_names are wrapped in
    {@TOOL: name} and {@AGENT: name} CES reference syntax respectively.

    Args:
        sections: Map of section name → XML text. May be custom_sections from
                  the request (user-edited overrides) or AI-generated texts.
        identity_dict: Serialised AgentIdentityInput used to build <role>.
        task_modules: Optional list of TaskModuleEntry to embed in the output.
        tool_names: Tool IDs assigned to this agent — used to inject {@TOOL:} refs.
        agent_names: Sub-agent names available for delegation — injects {@AGENT:} refs.
        sub_agents: Sub-agent dicts from SubAgentsInput — used to build delegation hints
                    in the <constraints> section.
        root_agent_slug: Slug of the root agent for out-of-scope routing constraint.
    """
    role_section = build_role_section_from_identity(
        name=identity_dict.get("agent_name", ""),
        purpose=identity_dict.get("agent_purpose", ""),
        agent_type=identity_dict.get("agent_type", ""),
        parent_context=identity_dict.get("parent_agent_context", ""),
    )

    section_order = [
        ("role", role_section),
        ("communication_guidelines", sections.get("communication_guidelines", "")),
        ("persona", sections.get("persona", "")),
        ("scope", sections.get("scope", "")),
        ("tools", sections.get("tools", "")),
        ("sub_agents", sections.get("sub_agents", "")),
        ("error_handling", sections.get("error_handling", "")),
    ]

    parts = []
    for _name, content in section_order:
        stripped = content.strip() if content else ""
        if stripped and not stripped.startswith("<!--"):
            parts.append(stripped)

    # Always append the deterministic <constraints> section
    constraints_xml = build_constraints_section(
        sub_agents=sub_agents or [],
        agent_type=identity_dict.get("agent_type", ""),
        root_agent_slug=root_agent_slug,
    )
    parts.append(constraints_xml)

    if task_modules:
        parts.append(render_task_modules_xml(task_modules))

    assembled = "\n\n".join(parts)
    return inject_ces_references(assembled, tool_names or [], agent_names or [])


# ── Quality checking ───────────────────────────────────────────────────────────

QUALITY_DIMENSIONS = [
    {
        "name": "Role Definition",
        "check": lambda text: "<role>" in text and "</role>" in text,
        "message_pass": "Agent has a clear role definition",
        "message_fail": "Missing <role> section — agent has no defined identity",
        "severity": "error",
    },
    {
        "name": "Persona and Tone",
        "check": lambda text: "<persona>" in text and "</persona>" in text,
        "message_pass": "Persona and communication style defined",
        "message_fail": "Missing <persona> section — agent tone will be inconsistent",
        "severity": "warning",
    },
    {
        "name": "Scope Boundaries",
        "check": lambda text: "<scope>" in text and "</scope>" in text,
        "message_pass": "In-scope and out-of-scope topics defined",
        "message_fail": "Missing <scope> section — agent may go off-topic",
        "severity": "error",
    },
    {
        "name": "Escalation Path",
        "check": lambda text: "<escalation>" in text and "</escalation>" in text,
        "message_pass": "Escalation triggers and behavior defined",
        "message_fail": "Missing <escalation> section — agent has no defined handoff path",
        "severity": "error",
    },
    {
        "name": "Error Handling",
        "check": lambda text: "<error_handling>" in text and "</error_handling>" in text,
        "message_pass": "Error and fallback behavior defined",
        "message_fail": "Missing <error_handling> section — agent will fail ungracefully",
        "severity": "warning",
    },
    {
        "name": "Tool References",
        "check": lambda text: "{@TOOL:" in text or "<tool_usage>" not in text,
        "message_pass": "Tool references use correct {@TOOL: name} syntax",
        "message_fail": "Tool usage section present but no {@TOOL: name} references found",
        "severity": "warning",
    },
    {
        "name": "Instruction Completeness",
        "check": lambda text: len(text) >= 500,
        "message_pass": "Instruction has sufficient detail",
        "message_fail": "Instruction is very short — may lack behavioral specificity",
        "severity": "warning",
    },
    {
        "name": "Instruction Length",
        "check": lambda text: len(text) <= 8000,
        "message_pass": "Instruction length is within recommended range",
        "message_fail": "Instruction exceeds 8000 chars — may affect model context window",
        "severity": "info",
    },
]

_WEIGHTS = {"error": 20, "warning": 10, "info": 5}


def run_quality_checks(instruction: str) -> tuple[list[QualityCheck], int]:
    """Run all quality dimensions against the assembled instruction.

    Score = (points earned / max possible points) * 100, rounded to int.
    Weights per severity: error=20, warning=10, info=5.
    A fully passing instruction scores 100.
    """
    checks: list[QualityCheck] = []
    points_earned = 0
    points_possible = 0

    for dim in QUALITY_DIMENSIONS:
        passed = dim["check"](instruction)
        weight = _WEIGHTS[dim["severity"]]
        points_possible += weight
        if passed:
            points_earned += weight
        checks.append(
            QualityCheck(
                dimension=dim["name"],
                passed=passed,
                message=dim["message_pass"] if passed else dim["message_fail"],
                severity=dim["severity"],
            )
        )

    score = round((points_earned / points_possible) * 100) if points_possible > 0 else 0
    return checks, score


def get_section_breakdown(instruction: str) -> dict[str, int]:
    """Return character count per XML section tag found in the instruction.

    Example: {"role": 150, "persona": 320, "scope": 280, ...}
    Only counts the content inside the outermost matching tag pair.
    """
    breakdown: dict[str, int] = {}
    pattern = r"<(\w+)>(.*?)</\1>"
    for tag, content in re.findall(pattern, instruction, re.DOTALL):
        breakdown[tag] = len(content.strip())
    return breakdown


# ── Full assembly endpoint logic ───────────────────────────────────────────────

async def assemble_full_instruction(
    request: AssembleInstructionRequest,
) -> AssembleInstructionResponse:
    """Assemble the instruction from all section inputs and run quality checks.

    custom_sections in the request act as user-edited overrides: any section
    present there is used verbatim instead of being re-generated. Sections
    absent from custom_sections are left empty (the caller is expected to have
    already generated them section-by-section and passed the results in
    custom_sections, or to accept a minimal instruction).

    If request.task_modules is empty, generates task_modules automatically from
    the identity and tools inputs before assembling.
    """
    gemini = get_gemini_service()
    identity_dict = request.identity.model_dump()
    persona_dict = request.persona.model_dump()

    # Collect tool and agent names for {@TOOL:} / {@AGENT:} reference injection
    all_tool_names = [t.tool_name for t in request.tools.tools]
    all_agent_names = [a.agent_name for a in request.sub_agents.sub_agents]

    # Collect variable declarations for prompt context and post-assembly validation
    all_variable_names = [v.name for v in request.variable_declarations]
    declared_var_set = set(all_variable_names)

    # Generate task_modules if not provided by the caller
    task_modules = request.task_modules
    if not task_modules:
        tm_response = await generate_task_modules(
            GenerateTaskModulesRequest(
                agent_type=request.identity.agent_type,
                role_summary=request.identity.agent_purpose,
                variable_names=all_variable_names,
                tool_names=all_tool_names,
            )
        )
        task_modules = tm_response.task_modules

    all_sub_agents = [a.model_dump() for a in request.sub_agents.sub_agents]

    instruction = assemble_instruction(
        sections=request.custom_sections or {},
        identity_dict=identity_dict,
        task_modules=task_modules,
        tool_names=all_tool_names,
        agent_names=all_agent_names,
        sub_agents=all_sub_agents,
        root_agent_slug=request.root_agent_slug,
    )

    global_prompt = get_global_instruction_prompt(
        identity_dict, persona_dict, request.scope.model_dump()
    )
    global_instruction = await gemini.generate_with_retry(
        prompt=global_prompt,
        system_instruction=SYSTEM_INSTRUCTION_BASE,
        temperature=0.3,
        max_output_tokens=512,
    )

    quality_checks, quality_score = run_quality_checks(instruction)
    section_breakdown = get_section_breakdown(instruction)

    # Warn about any {VARNAME} references not declared in variableDeclarations
    variable_warnings = validate_variable_references(instruction, declared_var_set)
    if variable_warnings:
        for w in variable_warnings:
            logger.warning("Instruction variable reference issue: %s", w)

    return AssembleInstructionResponse(
        instruction=instruction,
        global_instruction=global_instruction.strip(),
        quality_score=quality_score,
        quality_checks=quality_checks,
        character_count=len(instruction),
        estimated_tokens=len(instruction) // 4,
        section_breakdown=section_breakdown,
        task_modules=task_modules,
        variable_warnings=variable_warnings,
    )
