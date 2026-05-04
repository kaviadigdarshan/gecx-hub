"""Prompt templates and system prompts for the Instruction Architect accelerator."""

INSTRUCTION_SYSTEM_PROMPT = """You are a CX Agent Studio instruction architect.
Generate agent instructions in the official Google CX Agent Studio format.
Structure your output using the recommended XML format below — it helps the
model follow instructions more precisely:

{variable_name}          ← inject runtime variables using snake_case in braces
{@TOOL: tool_name}       ← reference tools by display name
{@AGENT: Agent Name}     ← reference sub-agents by display name

Use this XML skeleton, populating only the sections relevant to the agent:

<role>[One sentence defining the agent's core function or responsibility]</role>

<persona>
    <primary_goal>[The agent's main objective]</primary_goal>
    [Tone, behavioral guidelines, and how to handle prohibited topics]
</persona>

<constraints>
    [Numbered list of strict rules or limitations the agent must follow]
</constraints>

<taskflow>
    <subtask name="[Subtask Name]">
        <step name="[Step Name]">
            <trigger>[Condition or user input that initiates this step]</trigger>
            <action>[What the agent does when triggered]</action>
        </step>
    </subtask>
</taskflow>

<examples>
    EXAMPLE 1:
    Begin example
    [user]
    [Sample user query]
    [model]
    ```tool_code
    tool_name(param="value")
    ```
    ```tool_outputs
    {"key": "value"}
    ```
    [model]
    [Agent's final response using the tool output]
    End example
</examples>

Refer to: https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps/instruction
Output only the instruction content — no preamble, no markdown code fences."""


def get_task_modules_prompt(
    agent_type: str,
    role_summary: str,
    variable_list: str,
    tool_list: str,
) -> str:
    """Build the Gemini prompt for generating 2-4 reusable task_module blocks."""
    return (
        f"For a {agent_type} CX Agent Studio sub-agent with role: {role_summary}. "
        f"The agent has access to these session variables: {variable_list}. "
        f"The agent has access to these tools: {tool_list}. "
        "Generate 2-4 reusable task_module blocks that capture common conditional patterns. "
        "Each module must have: name (camelCase), trigger, action. "
        "Use {varname} syntax for session variables in trigger/action. "
        "Use {@TOOL: toolname} syntax for tool references in action. "
        'Return as JSON array: [{"name": "...", "trigger": "...", "action": "..."}]'
    )


def get_regenerate_task_prompt(
    vertical: str,
    agent_name: str,
    task_title: str,
) -> str:
    """Build the Gemini prompt for regenerating a single <task_module> block."""
    return (
        f"Rewrite this task module for a {vertical} agent named {agent_name}. "
        f"Task: {task_title}. "
        "Return only the <task_module>...</task_module> XML block with a name attribute, "
        "and child elements <trigger> and <action>."
    )
