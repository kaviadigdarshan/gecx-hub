"""Tests for the section prompt templates in templates/instructions/section_prompts.py.

All tests are synchronous — they only exercise the pure prompt-builder functions,
not Gemini itself.
"""

import pytest

from templates.instructions.section_prompts import (
    get_error_handling_prompt,
    get_persona_prompt,
    get_scope_prompt,
    get_sub_agents_prompt,
    get_tools_prompt,
)


# ── TestPromptTemplates ───────────────────────────────────────────────────────

class TestPromptTemplates:

    def test_persona_prompt_includes_agent_name(self, sample_identity, sample_persona):
        prompt = get_persona_prompt(
            sample_identity.model_dump(), sample_persona.model_dump()
        )
        assert sample_identity.agent_name in prompt

    def test_persona_prompt_includes_company_name(self, sample_identity, sample_persona):
        prompt = get_persona_prompt(
            sample_identity.model_dump(), sample_persona.model_dump()
        )
        assert sample_persona.company_name in prompt

    def test_persona_prompt_includes_tone(self, sample_identity, sample_persona):
        prompt = get_persona_prompt(
            sample_identity.model_dump(), sample_persona.model_dump()
        )
        assert sample_persona.tone in prompt

    def test_persona_prompt_includes_brand_voice_keywords(self, sample_identity, sample_persona):
        prompt = get_persona_prompt(
            sample_identity.model_dump(), sample_persona.model_dump()
        )
        for keyword in sample_persona.brand_voice_keywords:
            assert keyword in prompt

    def test_persona_prompt_includes_persona_name(self, sample_identity, sample_persona):
        prompt = get_persona_prompt(
            sample_identity.model_dump(), sample_persona.model_dump()
        )
        assert sample_persona.persona_name in prompt

    def test_scope_prompt_includes_all_goals(
        self, sample_identity, sample_persona, sample_scope
    ):
        prompt = get_scope_prompt(
            sample_identity.model_dump(),
            sample_persona.model_dump(),
            sample_scope.model_dump(),
        )
        for goal in sample_scope.primary_goals:
            assert goal in prompt

    def test_scope_prompt_includes_out_of_scope_topics(
        self, sample_identity, sample_persona, sample_scope
    ):
        prompt = get_scope_prompt(
            sample_identity.model_dump(),
            sample_persona.model_dump(),
            sample_scope.model_dump(),
        )
        for topic in sample_scope.out_of_scope_topics:
            assert topic in prompt

    def test_scope_prompt_includes_escalation_triggers(
        self, sample_identity, sample_persona, sample_scope
    ):
        prompt = get_scope_prompt(
            sample_identity.model_dump(),
            sample_persona.model_dump(),
            sample_scope.model_dump(),
        )
        for trigger in sample_scope.escalation_triggers:
            assert trigger in prompt

    def test_scope_prompt_includes_escalation_target(
        self, sample_identity, sample_persona, sample_scope
    ):
        prompt = get_scope_prompt(
            sample_identity.model_dump(),
            sample_persona.model_dump(),
            sample_scope.model_dump(),
        )
        assert sample_scope.escalation_target in prompt

    def test_tools_prompt_empty_when_no_tools(self, sample_identity, sample_scope):
        prompt = get_tools_prompt(
            sample_identity.model_dump(), sample_scope.model_dump(), []
        )
        assert prompt == ""

    def test_tools_prompt_includes_tool_names(
        self, sample_identity, sample_scope, sample_tools_input
    ):
        tools_dicts = [t.model_dump() for t in sample_tools_input.tools]
        prompt = get_tools_prompt(
            sample_identity.model_dump(), sample_scope.model_dump(), tools_dicts
        )
        assert "returns_api" in prompt

    def test_tools_prompt_includes_agent_tool_syntax(
        self, sample_identity, sample_scope, sample_tools_input
    ):
        tools_dicts = [t.model_dump() for t in sample_tools_input.tools]
        prompt = get_tools_prompt(
            sample_identity.model_dump(), sample_scope.model_dump(), tools_dicts
        )
        assert "{@TOOL:" in prompt

    def test_tools_prompt_includes_when_to_use(
        self, sample_identity, sample_scope, sample_tools_input
    ):
        tools_dicts = [t.model_dump() for t in sample_tools_input.tools]
        prompt = get_tools_prompt(
            sample_identity.model_dump(), sample_scope.model_dump(), tools_dicts
        )
        assert sample_tools_input.tools[0].when_to_use in prompt

    def test_tools_prompt_includes_tool_description(
        self, sample_identity, sample_scope, sample_tools_input
    ):
        tools_dicts = [t.model_dump() for t in sample_tools_input.tools]
        prompt = get_tools_prompt(
            sample_identity.model_dump(), sample_scope.model_dump(), tools_dicts
        )
        assert sample_tools_input.tools[0].tool_description in prompt

    def test_sub_agents_prompt_empty_when_no_agents(self, sample_identity):
        prompt = get_sub_agents_prompt(sample_identity.model_dump(), [])
        assert prompt == ""

    def test_sub_agents_prompt_includes_agent_names(self, sample_identity):
        sub_agents = [
            {
                "agent_name": "Billing Agent",
                "agent_capability": "Handles billing disputes",
                "delegation_condition": "When customer asks about billing",
            }
        ]
        prompt = get_sub_agents_prompt(sample_identity.model_dump(), sub_agents)
        assert "Billing Agent" in prompt

    def test_sub_agents_prompt_includes_agent_syntax(self, sample_identity):
        sub_agents = [
            {
                "agent_name": "Billing Agent",
                "agent_capability": "Handles billing disputes",
                "delegation_condition": "When customer asks about billing",
            }
        ]
        prompt = get_sub_agents_prompt(sample_identity.model_dump(), sub_agents)
        assert "{@AGENT:" in prompt

    def test_sub_agents_prompt_includes_delegation_condition(self, sample_identity):
        condition = "When customer asks about billing"
        sub_agents = [
            {
                "agent_name": "Billing Agent",
                "agent_capability": "Handles billing disputes",
                "delegation_condition": condition,
            }
        ]
        prompt = get_sub_agents_prompt(sample_identity.model_dump(), sub_agents)
        assert condition in prompt

    def test_error_handling_prompt_includes_fallback_behavior(
        self, sample_identity, sample_error_handling
    ):
        prompt = get_error_handling_prompt(
            sample_identity.model_dump(), sample_error_handling.model_dump()
        )
        assert (
            "apologize_and_escalate" in prompt
            or "escalate" in prompt.lower()
        )

    def test_error_handling_prompt_includes_max_clarification_attempts(
        self, sample_identity, sample_error_handling
    ):
        prompt = get_error_handling_prompt(
            sample_identity.model_dump(), sample_error_handling.model_dump()
        )
        assert str(sample_error_handling.max_clarification_attempts) in prompt

    def test_error_handling_prompt_includes_no_answer_response(
        self, sample_identity, sample_error_handling
    ):
        prompt = get_error_handling_prompt(
            sample_identity.model_dump(), sample_error_handling.model_dump()
        )
        assert sample_error_handling.no_answer_response in prompt

    def test_error_handling_prompt_includes_tool_failure_response(
        self, sample_identity, sample_error_handling
    ):
        prompt = get_error_handling_prompt(
            sample_identity.model_dump(), sample_error_handling.model_dump()
        )
        assert sample_error_handling.tool_failure_response in prompt

    def test_scope_prompt_includes_agent_name(
        self, sample_identity, sample_persona, sample_scope
    ):
        prompt = get_scope_prompt(
            sample_identity.model_dump(),
            sample_persona.model_dump(),
            sample_scope.model_dump(),
        )
        assert sample_identity.agent_name in prompt

    def test_prompts_return_non_empty_strings(
        self, sample_identity, sample_persona, sample_scope, sample_tools_input, sample_error_handling
    ):
        tools_dicts = [t.model_dump() for t in sample_tools_input.tools]
        assert get_persona_prompt(sample_identity.model_dump(), sample_persona.model_dump())
        assert get_scope_prompt(
            sample_identity.model_dump(), sample_persona.model_dump(), sample_scope.model_dump()
        )
        assert get_tools_prompt(
            sample_identity.model_dump(), sample_scope.model_dump(), tools_dicts
        )
        assert get_error_handling_prompt(
            sample_identity.model_dump(), sample_error_handling.model_dump()
        )
