"""
Prompt templates for Gemini-assisted generation of each CX Agent Studio instruction section.

Every prompt targets a specific XML-tagged block. Gemini processes these tags as
organizational structure — they are not a published standard, just a convention that
works well with Gemini's instruction following.

Reference syntax used in generated output:
  {@TOOL: tool_name}   — references a tool available to the agent
  {@AGENT: Agent Name} — references a sub-agent available for delegation
  {VARNAME}            — reads a CES session variable (e.g. {IS_LOGGED_IN})
"""


def _format_session_vars(session_vars: list[dict]) -> str:
    """Return a prompt snippet listing session variables, or empty string if none."""
    if not session_vars:
        return ""
    parts = [f"{{{v['name']}}} ({v.get('type', 'STRING')})" for v in session_vars]
    var_list = ", ".join(parts)
    return (
        f"\nAvailable session variables: {var_list}. "
        "Use {varname} syntax to reference them in conditions and actions where appropriate."
    )

SYSTEM_INSTRUCTION_BASE = """
You are an expert Google CX Agent Studio instruction engineer. Your job is to write
high-quality, precise instruction sections for LLM-native conversational agents
built on Google's CX Agent Studio platform (ces.googleapis.com).

CX Agent Studio agents use Gemini as their LLM. Instructions are natural language
text structured with XML tags like <role>, <persona>, <constraints>, <scope>,
<task>, <escalation>, <tool_usage>, <error_handling>. These tags help Gemini
organize and recall behavioral rules during conversations.

Rules for good instructions:
- Be specific and unambiguous. Vague instructions cause hallucinations.
- Use positive framing ("always do X") more than negative ("never do Y"),
  but include both.
- Keep each XML section focused on one concern.
- Reference tools by their exact names using {@TOOL: tool_name} syntax when relevant.
- Reference sub-agents using {@AGENT: Agent Name} syntax.
- Write in second person: "You are..." not "The agent is..."
- Avoid flowery language. Be direct and operational.

Output ONLY the XML-tagged instruction section text. No preamble, no explanation,
no markdown. Just the instruction XML.
"""


def get_persona_prompt(identity: dict, persona: dict) -> str:
    return f"""
Generate the <persona> section of a CX Agent Studio agent instruction.

Agent context:
- Agent name: {identity["agent_name"]}
- Agent purpose: {identity["agent_purpose"]}
- Agent type: {identity["agent_type"]}
- Company: {persona.get("company_name", "the company")}
- Persona name: {persona.get("persona_name") or "unnamed"}
- Tone: {persona["tone"]}
- Brand voice keywords: {", ".join(persona.get("brand_voice_keywords", []))}
- Language: {persona["language"]}

Generate a <persona> XML section that:
1. Introduces who the agent is (name if given, role, company)
2. Defines the communication style concretely (e.g., "use clear, simple language",
   "avoid jargon", "acknowledge emotions before solving problems")
3. Specifies how the tone manifests in responses (give 2-3 concrete behavioral examples)
4. States the language and any locale-specific considerations

Output format:
<persona>
[your generated content here]
</persona>
"""


def get_scope_prompt(
    identity: dict, persona: dict, scope: dict, session_vars: list[dict] | None = None
) -> str:
    goals_list = "\n".join(f"  - {g}" for g in scope["primary_goals"])
    oos_list = "\n".join(f"  - {t}" for t in scope["out_of_scope_topics"])
    escalation_list = "\n".join(f"  - {e}" for e in scope["escalation_triggers"])
    vars_block = _format_session_vars(session_vars or [])

    return f"""
Generate the <scope>, <task>, and <escalation> sections of a CX Agent Studio instruction.

Agent context:
- Agent: {identity["agent_name"]} — {identity["agent_purpose"]}
- Primary goals:
{goals_list}
- Out-of-scope topics (must deflect):
{oos_list}
- Escalation triggers (conditions to hand off to {scope["escalation_target"]}):
{escalation_list}
- Escalation target: {scope["escalation_target"]}{vars_block}

Generate three XML sections:

<scope>: Define what this agent handles and what it does not. For out-of-scope
topics, specify the deflection behavior (e.g., "politely explain this is outside
your scope and offer to help with X instead").

<task>: List the agent's primary responsibilities as a numbered or bulleted set
of concrete operational instructions. Each task should be specific enough that
Gemini knows exactly when it applies.

<escalation>: Define precisely when and how to escalate to {scope["escalation_target"]}.
Include: the triggering conditions, what to say to the user before escalating,
and the escalation action.

Output format:
<scope>
[scope content]
</scope>

<task>
[task content]
</task>

<escalation>
[escalation content]
</escalation>
"""


def get_tools_prompt(
    identity: dict, scope: dict, tools: list[dict], session_vars: list[dict] | None = None
) -> str:
    if not tools:
        return ""

    tools_list = "\n".join(
        f"  - Tool: {t['tool_name']}\n"
        f"    Does: {t['tool_description']}\n"
        f"    Use when: {t['when_to_use']}"
        for t in tools
    )
    vars_block = _format_session_vars(session_vars or [])

    return f"""
Generate the <tool_usage> section of a CX Agent Studio agent instruction.

Agent: {identity["agent_name"]} — {identity["agent_purpose"]}{vars_block}

Available tools (reference using {{@TOOL: tool_name}} syntax):
{tools_list}

Generate a <tool_usage> XML section that:
1. For EACH tool: specifies exactly when to call it, what inputs to gather first,
   and what to do with the response
2. Covers what to do if a tool call fails or returns no results
3. States whether to call tools proactively or only when asked
4. Uses the exact {{@TOOL: tool_name}} reference syntax for each tool mention

Be specific about the decision logic (e.g., "Before calling {{@TOOL: order_lookup}},
confirm the user has provided their order ID. If they haven't, ask for it first.")

Output format:
<tool_usage>
[your generated content here]
</tool_usage>
"""


def get_sub_agents_prompt(
    identity: dict, sub_agents: list[dict], session_vars: list[dict] | None = None
) -> str:
    if not sub_agents:
        return ""

    agents_list = "\n".join(
        f"  - Agent: {a['agent_name']}\n"
        f"    Capability: {a['agent_capability']}\n"
        f"    Delegate when: {a['delegation_condition']}"
        for a in sub_agents
    )
    vars_block = _format_session_vars(session_vars or [])

    return f"""
Generate the <delegation> section of a CX Agent Studio agent instruction.

Agent: {identity["agent_name"]} — {identity["agent_purpose"]}
This is a {"root agent" if identity["agent_type"] == "root_agent" else "sub-agent"}.{vars_block}

Sub-agents available (reference using {{@AGENT: Agent Name}} syntax):
{agents_list}

Generate a <delegation> XML section that:
1. For EACH sub-agent: specifies the exact condition that triggers delegation
2. States what context or information to pass to the sub-agent before delegating
3. Specifies whether to return to this agent after the sub-agent completes (if applicable)
4. Handles the case where no sub-agent is appropriate (handle directly or escalate)
5. Uses {{@AGENT: Agent Name}} reference syntax exactly

Output format:
<delegation>
[your generated content here]
</delegation>
"""


def get_error_handling_prompt(
    identity: dict, error_handling: dict, session_vars: list[dict] | None = None
) -> str:
    vars_block = _format_session_vars(session_vars or [])
    return f"""
Generate the <error_handling> section of a CX Agent Studio agent instruction.

Agent: {identity["agent_name"]} — {identity["agent_purpose"]}{vars_block}

Error handling configuration:
- When no answer found: "{error_handling.get("no_answer_response") or "apologize and offer alternatives"}"
- When tool fails: "{error_handling.get("tool_failure_response") or "apologize and try an alternative approach"}"
- Max clarification attempts before escalating: {error_handling.get("max_clarification_attempts", 2)}
- Fallback behavior: {error_handling.get("fallback_behavior", "apologize_and_escalate")}

Generate an <error_handling> XML section that:
1. Specifies what to say (exact tone and approach) when the agent cannot find an answer
2. Defines the retry/clarification loop: how many times to ask for clarification,
   what to say each time, and when to give up and escalate
3. Covers tool failure behavior: what to tell the user and what alternative to offer
4. Handles misunderstood requests: how to acknowledge confusion and ask for clarification
5. Ends with the ultimate fallback behavior if all else fails

Be specific. "Apologize politely" is too vague — describe the exact communication approach.

Output format:
<error_handling>
[your generated content here]
</error_handling>
"""


def get_communication_guidelines_prompt(identity: dict, comm_guidelines: dict) -> str:
    vertical = comm_guidelines.get("vertical", "general")
    language_code = comm_guidelines.get("language_code", "en-US")
    agent_type = identity.get("agent_type", "root_agent")

    return f"""
Generate the <communication_guidelines> section of a CX Agent Studio agent instruction.

Generate <communication_guidelines> for a {vertical} {agent_type} agent.
Language code: {language_code}.
Include: tone (1-2 sentences), format rules (bullet limits, response length), language formality.
Return XML fragment only.

The section must contain exactly three child tags:
- <tone>: 1-2 sentences describing the desired conversational tone appropriate for the {vertical} vertical
  and {agent_type} agent type (e.g. retail → friendly and helpful, bfsi → professional and precise,
  root_agent → orchestrating and composed, transactional → concise and task-focused)
- <format>: bullet-point count limits, maximum response length guidance, and structural preferences
- <language>: formality level, locale-specific guidance for {language_code}, and any register constraints

Output format:
<communication_guidelines>
  <tone>[tone guidance]</tone>
  <format>[format rules]</format>
  <language>[language formality and locale rules]</language>
</communication_guidelines>
"""


def get_global_instruction_prompt(identity: dict, persona: dict, scope: dict) -> str:
    return f"""
Generate a global_instruction string for a CX Agent Studio App.

The global_instruction applies to ALL agents in the App and sets:
- Brand tone and company identity
- Universal behavioral rules that every agent must follow regardless of their specific role
- Company name and any company-wide disclaimers

Context:
- Company: {persona.get("company_name", "the company")}
- Primary agent being built: {identity["agent_name"]} — {identity["agent_purpose"]}
- Overall brand tone: {persona["tone"]}
- Brand voice: {", ".join(persona.get("brand_voice_keywords", []))}

Generate a concise global_instruction (150-250 words) that:
1. States the company name and that all agents represent this company
2. Sets the universal brand tone
3. Lists 3-5 universal rules that apply across all agents (e.g., "Always identify
   yourself as an AI assistant", "Never make promises you cannot fulfill via available tools")
4. Includes a universal disclaimer if appropriate

Output ONLY the raw instruction text. No XML tags (global_instruction is plain text, not XML).
No preamble or explanation.
"""
