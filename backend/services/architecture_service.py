"""Gemini-powered multi-agent architecture suggestion and instruction scaffold service."""

import logging
import os

from fastapi import HTTPException

from models.accelerators.scaffolder import (
    AgentDefinition,
    ArchitectureSuggestRequest,
    ArchitectureSuggestion,
    VariableSuggestion,
)
from services.gemini_service import get_gemini_service
from templates.scaffolder.architecture_prompts import (
    get_architecture_suggestion_prompt,
    get_instruction_scaffold_prompt,
)

logger = logging.getLogger(__name__)


async def suggest_architecture(
    request: ArchitectureSuggestRequest,
) -> ArchitectureSuggestion:
    """Call Gemini to suggest a multi-agent topology for the given use case.

    Returns an ArchitectureSuggestion with a list of AgentDefinitions.
    Raises HTTPException 422 if Gemini returns an unusable response, or 502
    on a downstream Gemini failure.
    """
    gemini = get_gemini_service()
    prompt = get_architecture_suggestion_prompt(request.use_case.model_dump())

    try:
        raw = await gemini.generate_structured_json(
            prompt=prompt,
            temperature=0.3,    # lower temp = more consistent architecture proposals
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Architecture suggestion failed: {str(e)}")

    if "agents" not in raw:
        raise HTTPException(
            422,
            "AI returned invalid architecture structure — missing 'agents' key",
        )

    agents: list[AgentDefinition] = []
    for agent_data in raw.get("agents", []):
        try:
            agents.append(AgentDefinition(**agent_data))
        except Exception as exc:
            logger.warning("Skipping malformed agent from Gemini response: %s", exc)

    if not agents:
        raise HTTPException(
            422,
            "AI returned no valid agents — please try again with a more specific description",
        )

    # Guarantee exactly one root agent regardless of what Gemini returned
    root_agents = [a for a in agents if a.agent_type == "root_agent"]
    if len(root_agents) != 1:
        logger.warning(
            "Gemini returned %d root agents; coercing first agent to root_agent",
            len(root_agents),
        )
        agents[0] = agents[0].model_copy(update={"agent_type": "root_agent"})

    return ArchitectureSuggestion(
        agents=agents,
        rationale=raw.get("rationale", ""),
        decomposition_strategy=raw.get("decomposition_strategy", "capability_based"),
        root_agent_style=raw.get("root_agent_style", "pure_router"),
        estimated_complexity=raw.get("estimated_complexity", "moderate"),
    )


async def generate_instruction_scaffolds(
    agents: list[AgentDefinition],
    use_case: dict,
) -> dict[str, str]:
    """Generate a scaffold instruction for each agent using Gemini.

    Returns a dict of ``{ agent_slug: instruction_string }``.
    Agents are processed sequentially to avoid Vertex AI rate limits.
    Falls back to :func:`generate_minimal_instruction_scaffold` for any agent
    where Gemini fails so the overall scaffold generation is never blocked by a
    single agent failure.
    """
    gemini = get_gemini_service()
    scaffolds: dict[str, str] = {}
    all_agents_dicts = [a.model_dump() for a in agents]

    for agent in agents:
        prompt = get_instruction_scaffold_prompt(
            agent.model_dump(), use_case, all_agents_dicts
        )
        try:
            scaffold = await gemini.generate_with_retry(
                prompt=prompt,
                temperature=0.4,
                max_output_tokens=1024,
            )
            scaffolds[agent.slug] = scaffold.strip()
        except Exception as exc:
            logger.warning(
                "Gemini scaffold generation failed for agent '%s', using fallback: %s",
                agent.slug,
                exc,
            )
            scaffolds[agent.slug] = generate_minimal_instruction_scaffold(
                agent, use_case
            )

    return scaffolds


def generate_minimal_instruction_scaffold(
    agent: AgentDefinition,
    use_case: dict,
) -> str:
    """Pure-Python fallback scaffold — no Gemini call.

    Generates a minimal but structurally valid XML-tagged instruction with
    ``[CONFIGURE]`` markers in every section that needs developer input.
    Used when Gemini is unavailable or fails for a specific agent.
    """
    company = use_case.get("company_name") or "the company"

    delegation_section = ""
    if agent.agent_type == "root_agent":
        delegation_section = """

<delegation>
[CONFIGURE: Add delegation rules for each sub-agent using {@AGENT: Agent Name} syntax]
Example: When the user asks about orders, delegate to {@AGENT: Order Support Agent}.
</delegation>"""

    tool_section = ""
    if agent.suggested_tools:
        tool_refs = "\n".join(
            f"[CONFIGURE: Add rule for {{@TOOL: {t}}}]"
            for t in agent.suggested_tools
        )
        tool_section = f"""

<tool_usage>
{tool_refs}
</tool_usage>"""

    handles_text = (
        ", ".join(agent.handles)
        if agent.handles
        else "[CONFIGURE: list what this agent handles]"
    )

    return (
        f"<role>\n"
        f"You are {agent.name}, {agent.role_summary}.\n"
        f"You represent {company}.\n"
        f"</role>\n"
        f"\n"
        f"<persona>\n"
        f"[CONFIGURE: Define the communication tone, personality, and brand voice for {company}]\n"
        f"</persona>\n"
        f"\n"
        f"<scope>\n"
        f"You handle: {handles_text}.\n"
        f"[CONFIGURE: Define out-of-scope topics and how to deflect them]\n"
        f"</scope>"
        f"{delegation_section}"
        f"{tool_section}\n"
        f"\n"
        f"<escalation>\n"
        f"[CONFIGURE: Define when to escalate and to whom. Example: If the user is "
        f"frustrated after two failed resolution attempts, apologize and transfer to "
        f"a human agent.]\n"
        f"</escalation>\n"
        f"\n"
        f"<error_handling>\n"
        f"[CONFIGURE: Define what to say when no answer is found, when tools fail, "
        f"and what the ultimate fallback behavior is]\n"
        f"</error_handling>"
    )


# ── Session variable suggestions ──────────────────────────────────────────────

_DEMO_VARIABLE_SUGGESTIONS: list[dict] = [
    {"name": "IS_LOGGED_IN",   "type": "BOOLEAN", "default_value": False,  "description": "Whether the user is authenticated"},
    {"name": "SHOPPER_ID",     "type": "STRING",  "default_value": "",     "description": "Unique identifier for the shopper"},
    {"name": "IS_BH",          "type": "BOOLEAN", "default_value": False,  "description": "Whether the user is a Black Hand tier member"},
    {"name": "CUSTOM_OUTPUT",  "type": "OBJECT",  "default_value": {},     "description": "Custom structured output payload"},
    {"name": "ENV",            "type": "STRING",  "default_value": "prod", "description": "Deployment environment (dev/staging/prod)"},
    {"name": "SESSION_ID",     "type": "STRING",  "default_value": "",     "description": "Current session identifier"},
]

_VALID_TYPES = {"STRING", "BOOLEAN", "OBJECT", "ARRAY"}


async def suggest_session_variables(
    vertical: str,
    agents: list[dict],
) -> list[VariableSuggestion]:
    """Return 8-12 typed session variable suggestions for the given vertical.

    Uses Gemini when available; falls back to the retail demo set when
    ENVIRONMENT=demo or when Gemini fails.
    """
    if os.environ.get("ENVIRONMENT") == "demo":
        return [VariableSuggestion(**v) for v in _DEMO_VARIABLE_SUGGESTIONS]

    agent_names = ", ".join(a.get("name", a.get("slug", "")) for a in agents) or "the app agents"
    prompt = (
        f"For a {vertical} CX Agent Studio app with agents: {agent_names}, "
        f"suggest 8-12 typed session variables that the agents commonly need to share. "
        f"Return a JSON array where each item has: "
        f'name (UPPER_SNAKE_CASE string), '
        f'type (one of STRING | BOOLEAN | OBJECT | ARRAY), '
        f'default_value (matching the type — empty string, false, {{}}, or []), '
        f'description (one sentence). '
        f"Only return the JSON array, no other text."
    )

    gemini = get_gemini_service()
    try:
        raw = await gemini.generate_structured_json(prompt=prompt, temperature=0.3)
        items = raw if isinstance(raw, list) else raw.get("suggestions", raw.get("variables", []))
        suggestions: list[VariableSuggestion] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            var_type = str(item.get("type", "STRING")).upper()
            if var_type not in _VALID_TYPES:
                var_type = "STRING"
            suggestions.append(VariableSuggestion(
                name=str(item.get("name", "VAR")).upper(),
                type=var_type,  # type: ignore[arg-type]
                default_value=item.get("default_value", item.get("defaultValue")),
                description=str(item.get("description", "")),
            ))
        if suggestions:
            return suggestions
    except Exception as exc:
        logger.warning("Variable suggestion via Gemini failed, using demo fallback: %s", exc)

    return [VariableSuggestion(**v) for v in _DEMO_VARIABLE_SUGGESTIONS]
