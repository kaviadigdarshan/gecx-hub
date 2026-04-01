"""Gemini-powered multi-agent architecture suggestion and instruction scaffold service."""

import logging

from fastapi import HTTPException

from models.accelerators.scaffolder import (
    AgentDefinition,
    ArchitectureSuggestRequest,
    ArchitectureSuggestion,
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
