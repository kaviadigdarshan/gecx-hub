"""Unit tests for instruction_service: role building, assembly, quality checks,
section breakdown, and task_module generation/rendering.
"""

import pytest

from models.accelerators.instructions import TaskModuleEntry
from services.instruction_service import (
    assemble_instruction,
    build_constraints_section,
    build_role_section_from_identity,
    get_section_breakdown,
    inject_ces_references,
    render_task_modules_xml,
    run_quality_checks,
    validate_variable_references,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_full_instruction() -> str:
    """A complete, valid instruction that should score 100 on all quality checks.

    Designed to:
    - contain every required XML tag (<role>, <persona>, <scope>, <escalation>,
      <error_handling>, <tool_usage>)
    - include a {@TOOL:} reference so the tool-reference check passes
    - be >= 500 chars (completeness check)
    - be <= 8000 chars (length check)
    """
    return (
        "<role>\n"
        "You are Order Support Agent, a specialist customer service agent for Bluebell Retail.\n"
        "You operate as a specialist sub-agent handling all order-related queries including "
        "returns, exchanges, and refunds. You handle specific tasks delegated to you and "
        "return control to your parent agent when complete.\n"
        "</role>\n\n"
        "<persona>\n"
        "You represent Bluebell Retail. Communicate in a warm, clear, and professional manner. "
        "Acknowledge customer emotions before providing solutions. Use simple, jargon-free language. "
        "Always be empathetic when customers face difficulties with their orders.\n"
        "</persona>\n\n"
        "<scope>\n"
        "You handle all queries related to product returns, exchanges, and refund status. "
        "Out of scope: product recommendations, account management, and loyalty points queries. "
        "Politely redirect out-of-scope requests to the appropriate channel.\n"
        "</scope>\n\n"
        "<task>\n"
        "1. Greet the customer and identify their order-related query.\n"
        "2. Request the order ID if the customer has not provided it.\n"
        "3. Use {@TOOL: returns_api} to initiate the return once the customer confirms.\n"
        "4. Explain refund timelines clearly: 5-7 business days for most payment methods.\n"
        "5. Provide a reference number upon successful return initiation.\n"
        "</task>\n\n"
        "<escalation>\n"
        "Escalate to a human customer service agent when: the customer expresses significant "
        "frustration after two failed resolution attempts, or when a policy exception is required "
        "that is outside your authority. Before escalating, acknowledge the customer's frustration "
        "and inform them that a specialist will assist them shortly.\n"
        "</escalation>\n\n"
        "<tool_usage>\n"
        "Use {@TOOL: returns_api} when the customer wants to initiate a product return. "
        "Before calling {@TOOL: returns_api}, confirm the customer has provided their order ID "
        "and confirmed they wish to proceed. If the tool call fails, apologize and offer to "
        "manually log the request for follow-up by a specialist.\n"
        "</tool_usage>\n\n"
        "<error_handling>\n"
        "If no information is found for the given order ID, apologize and ask the customer to "
        "verify the order ID. After two failed clarification attempts, escalate to a human agent. "
        "If a tool call fails entirely, inform the customer there is a temporary technical issue "
        "and offer to try again in a few minutes or escalate the matter immediately.\n"
        "</error_handling>"
    )


# ── TestBuildRoleSection ──────────────────────────────────────────────────────

class TestBuildRoleSection:

    def test_root_agent_includes_primary_role_language(self, sample_identity):
        modified = sample_identity.model_copy(
            update={"agent_type": "root_agent", "parent_agent_context": ""}
        )
        result = build_role_section_from_identity(
            modified.agent_name,
            modified.agent_purpose,
            modified.agent_type,
            modified.parent_agent_context,
        )
        lower = result.lower()
        assert (
            "primary agent" in lower
            or "root" in lower
            or "users interact" in lower
        )

    def test_sub_agent_includes_delegation_context(self, sample_identity):
        result = build_role_section_from_identity(
            sample_identity.agent_name,
            sample_identity.agent_purpose,
            "sub_agent",
            sample_identity.parent_agent_context,
        )
        lower = result.lower()
        assert (
            "sub-agent" in lower
            or "specialist" in lower
            or "delegat" in lower
        )

    def test_output_wrapped_in_role_tags(self, sample_identity):
        result = build_role_section_from_identity(
            sample_identity.agent_name,
            sample_identity.agent_purpose,
            sample_identity.agent_type,
            sample_identity.parent_agent_context,
        )
        assert result.startswith("<role>")
        assert result.endswith("</role>")

    def test_agent_name_appears_in_role(self, sample_identity):
        result = build_role_section_from_identity(
            sample_identity.agent_name,
            sample_identity.agent_purpose,
            "root_agent",
            "",
        )
        assert sample_identity.agent_name in result

    def test_agent_purpose_appears_in_role(self, sample_identity):
        result = build_role_section_from_identity(
            sample_identity.agent_name,
            sample_identity.agent_purpose,
            "root_agent",
            "",
        )
        assert sample_identity.agent_purpose in result

    def test_sub_agent_with_no_parent_context_omits_delegation_line(self, sample_identity):
        # No parent_context → sub-agent branch is not triggered
        result = build_role_section_from_identity(
            sample_identity.agent_name,
            sample_identity.agent_purpose,
            "sub_agent",
            "",   # empty parent context
        )
        # Only the first role line should be present (no delegation paragraph)
        assert "parent agent" not in result.lower()

    def test_specialist_sub_agent_also_triggers_sub_agent_branch(self, sample_identity):
        result = build_role_section_from_identity(
            sample_identity.agent_name,
            sample_identity.agent_purpose,
            "specialist_sub_agent",
            "Root agent handles overall routing",
        )
        lower = result.lower()
        assert "specialist" in lower or "sub-agent" in lower or "delegat" in lower


# ── TestQualityChecks ─────────────────────────────────────────────────────────

class TestQualityChecks:

    def test_perfect_instruction_scores_100(self):
        checks, score = run_quality_checks(_make_full_instruction())
        assert score == 100

    def test_missing_role_tag_fails_role_check(self):
        instruction = "<persona>Hello</persona><scope>Things</scope>"
        checks, _score = run_quality_checks(instruction)
        role_check = next(c for c in checks if "Role" in c.dimension)
        assert role_check.passed is False

    def test_missing_role_tag_reduces_score_significantly(self):
        # Has all tags except <role>; still short (completeness also fails)
        instruction = (
            "<persona>Hello</persona>"
            "<scope>Things</scope>"
            "<task>Tasks</task>"
            "<escalation>Escalate</escalation>"
            "<error_handling>Handle</error_handling>"
        )
        _, score = run_quality_checks(instruction)
        # Missing role (error=20pts) + completeness warning (10pts) deducted
        assert score < 80

    def test_all_checks_have_correct_fields(self):
        checks, _ = run_quality_checks(_make_full_instruction())
        for check in checks:
            assert check.dimension
            assert isinstance(check.passed, bool)
            assert check.message
            assert check.severity in ("error", "warning", "info")

    def test_too_long_instruction_triggers_info_check(self):
        long_instruction = "<role>You are...</role>" + ("x" * 8001)
        checks, _ = run_quality_checks(long_instruction)
        length_check = next(c for c in checks if "Length" in c.dimension)
        assert length_check.passed is False

    def test_too_short_instruction_triggers_warning(self):
        short = "<role>You are an agent.</role>"
        checks, _ = run_quality_checks(short)
        completeness_check = next(c for c in checks if "Completeness" in c.dimension)
        assert completeness_check.passed is False

    def test_score_is_between_0_and_100(self):
        for instruction in ["", "<role>a</role>", _make_full_instruction()]:
            _, score = run_quality_checks(instruction)
            assert 0 <= score <= 100

    def test_missing_escalation_scores_below_missing_tool(self):
        # escalation missing = error severity (20pts deducted)
        # no tool_usage section = tool check passes (not penalised at all)
        # both instructions are too short → completeness warning deducted from both equally
        no_escalation = (
            "<role>R</role>"
            "<persona>P</persona>"
            "<scope>S</scope>"
            "<task>T</task>"
            "<error_handling>E</error_handling>"
        )
        # Add escalation back → only completeness warning remains
        no_tools = no_escalation + "<escalation>Escalate</escalation>"

        _, score_no_escalation = run_quality_checks(no_escalation)
        _, score_no_tools = run_quality_checks(no_tools)

        assert score_no_escalation < score_no_tools

    def test_empty_instruction_has_low_score(self):
        _, score = run_quality_checks("")
        # Only tool-ref check (warning=10) and length check (info=5) pass on empty string
        assert score < 30

    def test_persona_missing_deducts_warning_not_error(self):
        # Build a good instruction but without persona
        no_persona = _make_full_instruction().replace(
            "<persona>", "<!--"
        ).replace("</persona>", "-->")
        checks, score_without = run_quality_checks(no_persona)
        _, score_full = run_quality_checks(_make_full_instruction())

        persona_check = next(c for c in checks if "Persona" in c.dimension)
        assert persona_check.passed is False
        assert persona_check.severity == "warning"
        # Deduction is exactly one warning weight (10pts on 100-point scale)
        assert score_full - score_without <= 15


# ── TestSectionBreakdown ──────────────────────────────────────────────────────

class TestSectionBreakdown:

    def test_breakdown_contains_all_sections_present(self):
        instruction = (
            "<role>Role content here</role>\n"
            "<persona>Persona content</persona>"
        )
        breakdown = get_section_breakdown(instruction)
        assert "role" in breakdown
        assert "persona" in breakdown

    def test_breakdown_char_count_is_accurate(self):
        content = "This is exactly thirty chars.."  # 30 chars
        instruction = f"<role>{content}</role>"
        breakdown = get_section_breakdown(instruction)
        assert breakdown["role"] == len(content.strip())

    def test_empty_instruction_returns_empty_breakdown(self):
        assert get_section_breakdown("") == {}

    def test_only_counts_xml_tagged_sections(self):
        instruction = "Some plain text <role>Role here</role> more plain text"
        breakdown = get_section_breakdown(instruction)
        assert len(breakdown) == 1
        assert "role" in breakdown

    def test_breakdown_strips_whitespace_before_counting(self):
        instruction = "<role>\n  Content with padding  \n</role>"
        breakdown = get_section_breakdown(instruction)
        # strip() removes the surrounding newlines and spaces
        assert breakdown["role"] == len("Content with padding")

    def test_multiline_section_content_counted_correctly(self):
        instruction = "<persona>\nLine one.\nLine two.\n</persona>"
        breakdown = get_section_breakdown(instruction)
        expected = len("Line one.\nLine two.")
        assert breakdown["persona"] == expected

    def test_all_standard_sections_counted_when_present(self):
        instruction = _make_full_instruction()
        breakdown = get_section_breakdown(instruction)
        expected_tags = {"role", "persona", "scope", "task", "escalation", "tool_usage", "error_handling"}
        assert expected_tags.issubset(breakdown.keys())

    def test_section_counts_are_positive_integers(self):
        breakdown = get_section_breakdown(_make_full_instruction())
        for tag, count in breakdown.items():
            assert isinstance(count, int)
            assert count > 0


# ── TestAssembleInstruction ───────────────────────────────────────────────────

class TestAssembleInstruction:

    def test_role_section_always_first(self):
        sections = {
            "persona": "<persona>Persona content</persona>",
        }
        identity = {
            "agent_name": "Test Agent",
            "agent_purpose": "Test purpose",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        assert result.index("<role>") < result.index("<persona>")

    def test_empty_sections_excluded_from_output(self):
        sections = {
            "tools": "",                                      # empty → excluded
            "sub_agents": "<!-- No sub-agents configured -->",  # comment-only → excluded
        }
        identity = {
            "agent_name": "Test Agent",
            "agent_purpose": "Test purpose",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        assert "<!-- No sub-agents" not in result
        # Balanced XML tags: every opener has a closer
        assert result.count("<") == result.count(">")

    def test_custom_sections_override_defaults(self):
        custom_persona = "<persona>My custom persona text here.</persona>"
        sections = {"persona": custom_persona}
        identity = {
            "agent_name": "Agent",
            "agent_purpose": "Do things",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        assert "My custom persona text here." in result

    def test_output_sections_separated_by_double_newline(self):
        sections = {"persona": "<persona>P</persona>"}
        identity = {
            "agent_name": "A",
            "agent_purpose": "B",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        assert "\n\n" in result

    def test_comment_only_section_excluded(self):
        sections = {
            "tools": "<!-- No tools configured for this agent -->",
            "persona": "<persona>Valid persona</persona>",
        }
        identity = {
            "agent_name": "A",
            "agent_purpose": "B",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        assert "<!-- No tools" not in result
        assert "<persona>Valid persona</persona>" in result

    def test_identity_dict_builds_role_with_name_and_purpose(self):
        sections = {}
        identity = {
            "agent_name": "Refund Bot",
            "agent_purpose": "Process refunds quickly",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        assert "Refund Bot" in result
        assert "Process refunds quickly" in result

    def test_section_order_is_role_persona_scope_tools_subagents_errorhandling(self):
        sections = {
            "persona": "<persona>P</persona>",
            "scope": "<scope>S</scope>",
            "tools": "<tool_usage>T</tool_usage>",
            "sub_agents": "<delegation>D</delegation>",
            "error_handling": "<error_handling>E</error_handling>",
        }
        identity = {
            "agent_name": "A",
            "agent_purpose": "B",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(sections, identity)
        positions = {
            "role": result.index("<role>"),
            "persona": result.index("<persona>"),
            "scope": result.index("<scope>"),
            "tools": result.index("<tool_usage>"),
            "sub_agents": result.index("<delegation>"),
            "error_handling": result.index("<error_handling>"),
        }
        assert (
            positions["role"]
            < positions["persona"]
            < positions["scope"]
            < positions["tools"]
            < positions["sub_agents"]
            < positions["error_handling"]
        )


# ── TestRenderTaskModulesXml ──────────────────────────────────────────────────

class TestRenderTaskModulesXml:

    def _make_module(
        self, name: str = "checkLogin", trigger: str = "When IS_LOGGED_IN is false",
        action: str = "Ask user to log in."
    ) -> TaskModuleEntry:
        return TaskModuleEntry(name=name, trigger=trigger, action=action)

    def test_single_module_contains_name_attribute(self):
        module = self._make_module(name="checkLogin")
        xml = render_task_modules_xml([module])
        assert 'name="checkLogin"' in xml

    def test_single_module_contains_trigger_and_action_tags(self):
        module = self._make_module()
        xml = render_task_modules_xml([module])
        assert "<trigger>" in xml and "</trigger>" in xml
        assert "<action>" in xml and "</action>" in xml

    def test_trigger_content_is_rendered(self):
        module = self._make_module(trigger="When IS_LOGGED_IN is false")
        xml = render_task_modules_xml([module])
        assert "When IS_LOGGED_IN is false" in xml

    def test_action_content_is_rendered(self):
        module = self._make_module(action="Call {@TOOL: auth_check}.")
        xml = render_task_modules_xml([module])
        assert "Call {@TOOL: auth_check}." in xml

    def test_multiple_modules_are_separated_by_double_newline(self):
        modules = [self._make_module("moduleA"), self._make_module("moduleB")]
        xml = render_task_modules_xml(modules)
        assert "\n\n" in xml
        assert xml.count('<task_module') == 2

    def test_empty_list_returns_empty_string(self):
        xml = render_task_modules_xml([])
        assert xml == ""

    def test_varname_syntax_passes_through_unchanged(self):
        module = self._make_module(trigger="When {CART_VALUE} exceeds 100")
        xml = render_task_modules_xml([module])
        assert "{CART_VALUE}" in xml

    def test_tool_syntax_passes_through_unchanged(self):
        module = self._make_module(action="Use {@TOOL: returns_api} to initiate.")
        xml = render_task_modules_xml([module])
        assert "{@TOOL: returns_api}" in xml


# ── TestAssembleInstructionWithTaskModules ────────────────────────────────────

class TestAssembleInstructionWithTaskModules:

    _IDENTITY = {
        "agent_name": "Refund Agent",
        "agent_purpose": "Handle refund requests",
        "agent_type": "sub_agent",
        "parent_agent_context": "Root agent handles routing",
    }

    def test_task_modules_appear_in_output(self):
        module = TaskModuleEntry(
            name="checkLogin",
            trigger="When IS_LOGGED_IN is false",
            action="Ask user to log in.",
        )
        result = assemble_instruction({}, self._IDENTITY, task_modules=[module])
        assert '<task_module name="checkLogin">' in result

    def test_task_modules_appear_after_error_handling(self):
        sections = {"error_handling": "<error_handling>Handle errors.</error_handling>"}
        module = TaskModuleEntry(
            name="myModule",
            trigger="When something happens",
            action="Do something.",
        )
        result = assemble_instruction(sections, self._IDENTITY, task_modules=[module])
        error_pos = result.index("<error_handling>")
        module_pos = result.index('<task_module name="myModule">')
        assert error_pos < module_pos

    def test_no_task_modules_produces_no_task_module_tag(self):
        result = assemble_instruction({}, self._IDENTITY, task_modules=None)
        assert "<task_module" not in result

    def test_empty_task_modules_list_produces_no_task_module_tag(self):
        result = assemble_instruction({}, self._IDENTITY, task_modules=[])
        assert "<task_module" not in result

    def test_multiple_task_modules_all_appear(self):
        modules = [
            TaskModuleEntry(name="modA", trigger="Trigger A", action="Action A"),
            TaskModuleEntry(name="modB", trigger="Trigger B", action="Action B"),
        ]
        result = assemble_instruction({}, self._IDENTITY, task_modules=modules)
        assert 'name="modA"' in result
        assert 'name="modB"' in result

    def test_task_modules_trigger_content_in_output(self):
        module = TaskModuleEntry(
            name="checkStatus",
            trigger="When {ORDER_STATUS} is pending",
            action="Notify the user.",
        )
        result = assemble_instruction({}, self._IDENTITY, task_modules=[module])
        assert "When {ORDER_STATUS} is pending" in result

    def test_task_modules_action_content_in_output(self):
        module = TaskModuleEntry(
            name="callTool",
            trigger="When user requests refund",
            action="Call {@TOOL: refund_api}.",
        )
        result = assemble_instruction({}, self._IDENTITY, task_modules=[module])
        assert "Call {@TOOL: refund_api}." in result


# ── TestInjectCesReferences ───────────────────────────────────────────────────

class TestInjectCesReferences:

    def test_bare_tool_name_is_wrapped(self):
        result = inject_ces_references(
            "Call order_api to look up the order.",
            tool_names=["order_api"],
            agent_names=[],
        )
        assert "{@TOOL: order_api}" in result

    def test_already_wrapped_tool_ref_is_unchanged(self):
        text = "Call {@TOOL: order_api} to look up the order."
        result = inject_ces_references(text, tool_names=["order_api"], agent_names=[])
        assert result == text

    def test_wrapped_ref_not_double_wrapped(self):
        text = "Use {@TOOL: order_api} here and order_api there."
        result = inject_ces_references(text, tool_names=["order_api"], agent_names=[])
        assert "{@TOOL: {@TOOL:" not in result
        assert result.count("{@TOOL: order_api}") == 2

    def test_bare_agent_name_is_wrapped(self):
        result = inject_ces_references(
            "Delegate to BillingAgent for payment queries.",
            tool_names=[],
            agent_names=["BillingAgent"],
        )
        assert "{@AGENT: BillingAgent}" in result

    def test_already_wrapped_agent_ref_is_unchanged(self):
        text = "Route to {@AGENT: BillingAgent} for payment queries."
        result = inject_ces_references(text, tool_names=[], agent_names=["BillingAgent"])
        assert result == text

    def test_multiple_tools_all_injected(self):
        text = "Call order_api first, then returns_api if needed."
        result = inject_ces_references(
            text, tool_names=["order_api", "returns_api"], agent_names=[]
        )
        assert "{@TOOL: order_api}" in result
        assert "{@TOOL: returns_api}" in result

    def test_empty_tool_and_agent_lists_returns_text_unchanged(self):
        text = "Some instruction text with no references."
        assert inject_ces_references(text, tool_names=[], agent_names=[]) == text

    def test_tool_name_not_matched_as_substring(self):
        # "api" should not match inside "order_api"
        text = "Call order_api now."
        result = inject_ces_references(text, tool_names=["api"], agent_names=[])
        assert "{@TOOL: api}" not in result

    def test_assemble_instruction_injects_tool_refs(self):
        sections = {
            "tools": "<tool_usage>Use order_api to fetch the order details.</tool_usage>",
        }
        identity = {
            "agent_name": "Order Agent",
            "agent_purpose": "Handle orders",
            "agent_type": "sub_agent",
            "parent_agent_context": "Root agent routes orders",
        }
        result = assemble_instruction(
            sections, identity, tool_names=["order_api"], agent_names=[]
        )
        assert "{@TOOL: order_api}" in result

    def test_assemble_instruction_injects_agent_refs(self):
        sections = {
            "sub_agents": "<delegation>Route to BillingAgent for invoices.</delegation>",
        }
        identity = {
            "agent_name": "Root Agent",
            "agent_purpose": "Route queries",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(
            sections, identity, tool_names=[], agent_names=["BillingAgent"]
        )
        assert "{@AGENT: BillingAgent}" in result

    def test_assemble_instruction_without_names_is_backward_compatible(self):
        sections = {"persona": "<persona>Friendly agent.</persona>"}
        identity = {
            "agent_name": "A",
            "agent_purpose": "B",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        # Calling without tool_names/agent_names must not raise
        result = assemble_instruction(sections, identity)
        assert "<persona>" in result


# ── TestValidateVariableReferences ───────────────────────────────────────────

class TestValidateVariableReferences:

    def test_declared_variable_produces_no_warning(self):
        text = "Check if {IS_LOGGED_IN} is true before proceeding."
        warnings = validate_variable_references(text, {"IS_LOGGED_IN"})
        assert warnings == []

    def test_undeclared_variable_produces_warning(self):
        text = "Use {SHOPPER_ID} to look up the account."
        warnings = validate_variable_references(text, set())
        assert len(warnings) == 1
        assert "SHOPPER_ID" in warnings[0]

    def test_multiple_undeclared_variables_each_produce_warning(self):
        text = "Check {IS_LOGGED_IN} and {CART_VALUE} before proceeding."
        warnings = validate_variable_references(text, set())
        assert len(warnings) == 2

    def test_duplicate_undeclared_variable_warned_only_once(self):
        text = "If {IS_LOGGED_IN} is false, prompt login. When {IS_LOGGED_IN} is true, continue."
        warnings = validate_variable_references(text, set())
        assert len(warnings) == 1

    def test_tool_references_not_matched_as_variables(self):
        text = "Call {@TOOL: order_api} to fetch order details."
        warnings = validate_variable_references(text, set())
        assert warnings == []

    def test_agent_references_not_matched_as_variables(self):
        text = "Delegate to {@AGENT: BillingAgent} for invoices."
        warnings = validate_variable_references(text, set())
        assert warnings == []

    def test_lowercase_tokens_not_matched(self):
        # {varname} template tokens in prompt text should not be flagged
        text = "Use {varname} syntax for session variables."
        warnings = validate_variable_references(text, set())
        assert warnings == []

    def test_empty_text_returns_no_warnings(self):
        assert validate_variable_references("", set()) == []

    def test_empty_declared_set_with_no_vars_in_text_returns_no_warnings(self):
        assert validate_variable_references("No variables here.", set()) == []

    def test_mixed_declared_and_undeclared(self):
        text = "If {IS_LOGGED_IN} is true and {UNKNOWN_VAR} is set, proceed."
        warnings = validate_variable_references(text, {"IS_LOGGED_IN"})
        assert len(warnings) == 1
        assert "UNKNOWN_VAR" in warnings[0]
        assert "IS_LOGGED_IN" not in warnings[0]


# ── TestBuildConstraintsSection ───────────────────────────────────────────────

class TestBuildConstraintsSection:

    # ── human escalation constraint (all agents) ──────────────────────────────

    def test_root_agent_contains_human_escalation_constraint(self):
        result = build_constraints_section(
            sub_agents=[], agent_type="root_agent", root_agent_slug="main_agent"
        )
        assert "{@AGENT: human_agent_transfer}" in result
        assert "speak to a human agent" in result

    def test_sub_agent_contains_human_escalation_constraint(self):
        result = build_constraints_section(
            sub_agents=[], agent_type="sub_agent", root_agent_slug="main_agent"
        )
        assert "{@AGENT: human_agent_transfer}" in result

    def test_specialist_sub_agent_contains_human_escalation_constraint(self):
        result = build_constraints_section(
            sub_agents=[], agent_type="specialist_sub_agent", root_agent_slug="main_agent"
        )
        assert "{@AGENT: human_agent_transfer}" in result

    # ── out-of-scope routing constraint (sub-agents only) ─────────────────────

    def test_root_agent_does_not_contain_out_of_scope_routing(self):
        result = build_constraints_section(
            sub_agents=[], agent_type="root_agent", root_agent_slug="main_agent"
        )
        assert "out-of-scope" not in result
        assert "{@AGENT: main_agent}" not in result

    def test_sub_agent_contains_out_of_scope_routing_with_root_slug(self):
        result = build_constraints_section(
            sub_agents=[], agent_type="sub_agent", root_agent_slug="main_agent"
        )
        assert "{@AGENT: main_agent}" in result
        assert "out-of-scope" in result

    def test_sub_agent_without_root_slug_omits_routing_constraint(self):
        # If no root slug provided, the routing constraint is skipped (no blank agent ref)
        result = build_constraints_section(
            sub_agents=[], agent_type="sub_agent", root_agent_slug=""
        )
        assert "out-of-scope" not in result

    # ── per-sub-agent delegation hints ────────────────────────────────────────

    def test_sub_agent_delegation_hint_uses_delegation_condition(self):
        sub_agents = [
            {
                "agent_name": "BillingAgent",
                "agent_capability": "handles billing",
                "delegation_condition": "user asks about invoices or payments",
            }
        ]
        result = build_constraints_section(
            sub_agents=sub_agents, agent_type="root_agent", root_agent_slug=""
        )
        assert "{@AGENT: BillingAgent}" in result
        assert "user asks about invoices or payments" in result

    def test_sub_agent_delegation_hint_falls_back_to_capability(self):
        sub_agents = [
            {
                "agent_name": "ShippingAgent",
                "agent_capability": "tracks shipments",
                "delegation_condition": "",
            }
        ]
        result = build_constraints_section(
            sub_agents=sub_agents, agent_type="root_agent", root_agent_slug=""
        )
        assert "{@AGENT: ShippingAgent}" in result
        assert "tracks shipments" in result

    def test_multiple_sub_agents_all_appear(self):
        sub_agents = [
            {"agent_name": "BillingAgent", "agent_capability": "billing", "delegation_condition": "invoice"},
            {"agent_name": "ShippingAgent", "agent_capability": "shipping", "delegation_condition": "delivery"},
        ]
        result = build_constraints_section(
            sub_agents=sub_agents, agent_type="root_agent", root_agent_slug=""
        )
        assert "{@AGENT: BillingAgent}" in result
        assert "{@AGENT: ShippingAgent}" in result

    def test_sub_agent_with_empty_name_is_skipped(self):
        sub_agents = [{"agent_name": "", "agent_capability": "does something", "delegation_condition": ""}]
        result = build_constraints_section(
            sub_agents=sub_agents, agent_type="root_agent", root_agent_slug=""
        )
        # no delegate hint for unnamed agent
        assert "delegate" not in result.lower() or "{@AGENT: }" not in result

    # ── XML structure ─────────────────────────────────────────────────────────

    def test_output_is_wrapped_in_constraints_tags(self):
        result = build_constraints_section(
            sub_agents=[], agent_type="root_agent", root_agent_slug=""
        )
        assert result.startswith("<constraints>")
        assert result.endswith("</constraints>")

    # ── integration: assemble_instruction includes constraints ─────────────────

    def test_assemble_instruction_always_includes_constraints(self):
        identity = {
            "agent_name": "Order Agent",
            "agent_purpose": "Handle orders",
            "agent_type": "sub_agent",
            "parent_agent_context": "Root routes queries",
        }
        result = assemble_instruction(
            sections={},
            identity_dict=identity,
            root_agent_slug="main_agent",
        )
        assert "<constraints>" in result
        assert "{@AGENT: human_agent_transfer}" in result
        assert "{@AGENT: main_agent}" in result

    def test_assemble_instruction_root_agent_no_routing_constraint(self):
        identity = {
            "agent_name": "Main Agent",
            "agent_purpose": "Route queries",
            "agent_type": "root_agent",
            "parent_agent_context": "",
        }
        result = assemble_instruction(
            sections={},
            identity_dict=identity,
            root_agent_slug="main_agent",
        )
        assert "<constraints>" in result
        assert "{@AGENT: human_agent_transfer}" in result
        # Root agent must NOT have the out-of-scope routing constraint
        assert "out-of-scope" not in result
