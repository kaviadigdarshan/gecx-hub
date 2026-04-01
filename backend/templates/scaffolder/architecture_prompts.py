"""
Prompt templates for Gemini-assisted multi-agent architecture design and
instruction scaffold generation in the App Scaffolder accelerator.
"""

CAPABILITY_DESCRIPTIONS = {
    "returns_refunds": "Processing product returns, exchanges, and refund requests",
    "order_management": "Order status lookup, modification, and cancellation",
    "account_management": "Account details, preferences, and profile updates",
    "product_recommendations": "Personalized product suggestions and catalog queries",
    "payment_support": "Payment issues, billing queries, and payment method management",
    "appointment_booking": "Scheduling, rescheduling, and cancelling appointments",
    "technical_support": "Technical troubleshooting and product usage guidance",
    "loyalty_rewards": "Loyalty points, rewards redemption, and tier status",
    "escalation_to_human": "Routing to human agents for complex or sensitive cases",
    "faq_knowledge": "Answering common questions from knowledge base/documentation",
    "inventory_lookup": "Real-time product availability and stock queries",
    "shipment_tracking": "Shipment status, delivery estimates, and carrier updates",
}

DECOMPOSITION_GUIDANCE = """
CX Agent Studio multi-agent decomposition principles:
1. Each sub-agent should own a distinct, coherent set of user intents
2. A root agent (pure router) passes control to sub-agents immediately —
   it does not answer user questions directly
3. A root agent (hybrid) handles simple/FAQ queries itself and delegates complex ones
4. Avoid agents with more than 4-5 distinct capabilities (causes instruction bloat)
5. Avoid more than 6-8 total agents (routing complexity increases exponentially)
6. Voice channel: simpler topology preferred (fewer agents, shorter instructions)
7. Overlapping capabilities between agents causes routing ambiguity — avoid
8. Always include one escalation path to human agent (either as an agent or as an
   escalation trigger in all agents)
"""

TOOL_ASSIGNMENT_GUIDANCE = """
Tool assignment principles:
- Each sub-agent should only have access to tools it actually needs
- Avoid giving all tools to the root agent (creates unnecessary coupling)
- Data store tools (RAG) should be assigned to the agent handling knowledge/FAQ queries
- OpenAPI tools should be scoped to the agent that owns that business capability
- Google Search tool: assign only to agents that explicitly need web searches
"""


def get_architecture_suggestion_prompt(use_case: dict) -> str:
    capabilities_text = "\n".join(
        f"  - {c}: {CAPABILITY_DESCRIPTIONS.get(c, c)}"
        for c in use_case.get("expected_capabilities", [])
    )
    if not capabilities_text:
        capabilities_text = (
            "  (no specific capabilities selected — suggest based on use case)"
        )

    return f"""
You are a Google CX Agent Studio architect. Design a multi-agent topology for the following use case.

Business domain: {use_case["business_domain"]}
Company: {use_case.get("company_name") or "a company in this domain"}
Channel: {use_case["channel"]}

Primary use case description:
{use_case["primary_use_case"]}

Expected capabilities to handle:
{capabilities_text}

{DECOMPOSITION_GUIDANCE}
{TOOL_ASSIGNMENT_GUIDANCE}

Design a multi-agent architecture. Return ONLY a JSON object with this exact structure:
{{
  "agents": [
    {{
      "name": "Root Agent",
      "slug": "root_agent",
      "agent_type": "root_agent",
      "role_summary": "One sentence describing what this agent's role is",
      "handles": ["capability_slug_1", "capability_slug_2"],
      "suggested_tools": [],
      "ai_generated": true
    }},
    {{
      "name": "Sub-Agent Display Name",
      "slug": "sub_agent_slug",
      "agent_type": "sub_agent",
      "role_summary": "One sentence describing what this agent handles",
      "handles": ["capability_slug"],
      "suggested_tools": ["tool_name_suggestion"],
      "ai_generated": true
    }}
  ],
  "rationale": "Explain in 2-3 sentences why you decomposed the agents this way",
  "decomposition_strategy": "capability_based",
  "root_agent_style": "pure_router",
  "estimated_complexity": "moderate"
}}

Rules:
- decomposition_strategy must be one of: capability_based, channel_based, hybrid
- root_agent_style must be one of: pure_router, hybrid
- estimated_complexity must be one of: simple, moderate, complex
- agent_type must be one of: root_agent, sub_agent
- slug must be lowercase with underscores only (no spaces or hyphens)
- Always include exactly one root_agent
- For voice channel: prefer simpler topology (2-4 agents max)
- For web_chat: can be more complex (up to 6-7 agents)
- suggested_tools: use generic names like "order_api", "crm_api", "knowledge_base"
- handles: use only slugs from this list: {list(CAPABILITY_DESCRIPTIONS.keys())}
- Include escalation_to_human in exactly one agent's handles list
- No trailing commas. Valid JSON only.
"""


def get_instruction_scaffold_prompt(
    agent: dict,
    use_case: dict,
    all_agents: list[dict],
) -> str:
    sibling_names = [a["name"] for a in all_agents if a["slug"] != agent["slug"]]

    return f"""
Generate a scaffold instruction for a CX Agent Studio agent. The instruction should
have all XML sections present but with placeholder content that a developer can fill in.
Mark each section with [CONFIGURE: description of what to fill in here].

Agent name: {agent["name"]}
Agent type: {agent["agent_type"]}
Role: {agent["role_summary"]}
Domain: {use_case["business_domain"]}
Company: {use_case.get("company_name") or "the company"}
Channel: {use_case["channel"]}
Handles: {", ".join(agent.get("handles", []))}
{"Root agent — delegates to: " + ", ".join(sibling_names) if agent["agent_type"] == "root_agent" else ""}
{"Sub-agent tools: " + ", ".join(agent.get("suggested_tools", [])) if agent.get("suggested_tools") else ""}

Generate a scaffold instruction with these sections:
<role> — filled with the agent's actual role
<persona> — [CONFIGURE: define tone and persona for {use_case.get("company_name") or "your company"}]
<scope> — partially filled based on handles, with [CONFIGURE] markers for specifics
{"<delegation> — list each sub-agent with {@AGENT: Agent Name} references and [CONFIGURE: add delegation condition]" if agent["agent_type"] == "root_agent" else ""}
{"<tool_usage> — list each tool with {@TOOL: tool_name} and [CONFIGURE: when to call it]" if agent.get("suggested_tools") else ""}
<escalation> — [CONFIGURE: define escalation triggers and target]
<error_handling> — [CONFIGURE: define fallback behavior]

Output ONLY the instruction string. No preamble. No explanation. Just the XML-tagged instruction.
"""
