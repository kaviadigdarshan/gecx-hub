"""Core service for AI-assisted agent instruction generation and assembly."""

import re

from fastapi import HTTPException

from models.accelerators.instructions import (
    AssembleInstructionRequest,
    AssembleInstructionResponse,
    GenerateSectionRequest,
    GenerateSectionResponse,
    QualityCheck,
)
from services.gemini_service import get_gemini_service
from templates.instructions.section_prompts import (
    SYSTEM_INSTRUCTION_BASE,
    get_error_handling_prompt,
    get_global_instruction_prompt,
    get_persona_prompt,
    get_scope_prompt,
    get_sub_agents_prompt,
    get_tools_prompt,
)


# ── Section generation ────────────────────────────────────────────────────────

async def generate_section(request: GenerateSectionRequest) -> GenerateSectionResponse:
    """Call Gemini to generate a single instruction section.

    Routes to the correct prompt builder based on request.section.
    Returns a pre-filled response (no Gemini call) when the relevant
    inputs are empty (no tools, no sub-agents).
    """
    gemini = get_gemini_service()
    identity_dict = request.identity.model_dump()

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
        )

    elif request.section == "tools":
        if request.scope is None or request.tools is None:
            raise HTTPException(status_code=422, detail="scope and tools are required for the tools section")
        prompt = get_tools_prompt(
            identity_dict,
            request.scope.model_dump(),
            [t.model_dump() for t in request.tools.tools],
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
        )
        if not prompt:
            return GenerateSectionResponse(
                section="sub_agents",
                generated_xml="<!-- No sub-agents configured -->",
                token_count_estimate=0,
            )

    elif request.section == "error_handling":
        error_dict = request.error_handling.model_dump() if request.error_handling else {}
        prompt = get_error_handling_prompt(identity_dict, error_dict)

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
) -> str:
    """Assemble the final instruction string from individual XML section texts.

    The <role> section is always auto-built from identity inputs and prepended
    first. Remaining sections follow a fixed order. Empty sections and HTML
    comment placeholders are omitted from the output.

    Args:
        sections: Map of section name → XML text. May be custom_sections from
                  the request (user-edited overrides) or AI-generated texts.
        identity_dict: Serialised AgentIdentityInput used to build <role>.
    """
    role_section = build_role_section_from_identity(
        name=identity_dict.get("agent_name", ""),
        purpose=identity_dict.get("agent_purpose", ""),
        agent_type=identity_dict.get("agent_type", ""),
        parent_context=identity_dict.get("parent_agent_context", ""),
    )

    section_order = [
        ("role", role_section),
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

    return "\n\n".join(parts)


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
    """
    gemini = get_gemini_service()
    identity_dict = request.identity.model_dump()
    persona_dict = request.persona.model_dump()

    instruction = assemble_instruction(
        sections=request.custom_sections or {},
        identity_dict=identity_dict,
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

    return AssembleInstructionResponse(
        instruction=instruction,
        global_instruction=global_instruction.strip(),
        quality_score=quality_score,
        quality_checks=quality_checks,
        character_count=len(instruction),
        estimated_tokens=len(instruction) // 4,
        section_breakdown=section_breakdown,
    )
