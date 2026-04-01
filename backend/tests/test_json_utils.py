"""Unit tests for utils/json_utils.py — 4-strategy JSON extraction cascade."""

import json
import pytest

from utils.json_utils import extract_json_from_llm_response


class TestExtractJsonFromLlmResponse:

    # ── Strategy 1: direct parse ─────────────────────────────────────────────

    def test_clean_json_object_parses_directly(self):
        raw = '{"agents": [{"name": "Root"}], "rationale": "clear"}'
        result = extract_json_from_llm_response(raw)
        assert result["agents"][0]["name"] == "Root"

    def test_clean_json_array_parses_directly(self):
        raw = '[{"type": "content_filter"}, {"type": "model_safety"}]'
        result = extract_json_from_llm_response(raw)
        assert len(result) == 2

    def test_json_with_leading_trailing_whitespace(self):
        raw = '  \n  {"key": "value"}  \n  '
        result = extract_json_from_llm_response(raw)
        assert result["key"] == "value"

    # ── Strategy 2: markdown fence stripping ─────────────────────────────────

    def test_json_in_backtick_fence_is_extracted(self):
        raw = '```json\n{"agents": [], "rationale": "test"}\n```'
        result = extract_json_from_llm_response(raw)
        assert "agents" in result

    def test_json_in_plain_fence_is_extracted(self):
        raw = '```\n{"key": "value"}\n```'
        result = extract_json_from_llm_response(raw)
        assert result["key"] == "value"

    def test_fenced_json_with_preamble_text_is_extracted(self):
        raw = 'Sure! Here is the JSON:\n```json\n{"agents": []}\n```\nHope that helps!'
        result = extract_json_from_llm_response(raw)
        assert "agents" in result

    def test_fenced_json_with_multiline_preamble(self):
        raw = (
            "Here is the architecture I suggest:\n"
            "It has two agents.\n"
            "```json\n"
            '{"agents": [{"name": "Root"}, {"name": "Sub"}]}\n'
            "```"
        )
        result = extract_json_from_llm_response(raw)
        assert len(result["agents"]) == 2

    # ── Strategy 3: first brace scan ─────────────────────────────────────────

    def test_json_embedded_in_prose_is_extracted(self):
        raw = 'The result is: {"status": "ok", "count": 3} as you can see above.'
        result = extract_json_from_llm_response(raw)
        assert result["status"] == "ok"
        assert result["count"] == 3

    def test_nested_json_object_extracted_correctly(self):
        raw = 'Output: {"outer": {"inner": "value"}} end'
        result = extract_json_from_llm_response(raw)
        assert result["outer"]["inner"] == "value"

    def test_json_after_colon_in_prose(self):
        raw = 'Response: {"decomposition_strategy": "capability_based"}'
        result = extract_json_from_llm_response(raw)
        assert result["decomposition_strategy"] == "capability_based"

    # ── Error / failure cases ─────────────────────────────────────────────────

    def test_invalid_json_raises_value_error(self):
        raw = "This is not JSON at all, just prose without any braces."
        with pytest.raises((ValueError, Exception)):
            extract_json_from_llm_response(raw)

    def test_empty_string_raises(self):
        with pytest.raises((ValueError, Exception)):
            extract_json_from_llm_response("")

    def test_whitespace_only_raises(self):
        with pytest.raises((ValueError, Exception)):
            extract_json_from_llm_response("   \n\t  ")

    def test_truncated_json_raises(self):
        # Strategy 3 finds '{', trims to last '}' — but there is none → raises
        raw = '{"agents": [{"name": "Root"'
        with pytest.raises((ValueError, Exception)):
            extract_json_from_llm_response(raw)

    def test_only_opening_brace_raises(self):
        with pytest.raises((ValueError, Exception)):
            extract_json_from_llm_response("{")

    # ── Edge cases ────────────────────────────────────────────────────────────

    def test_unicode_content_preserved(self):
        raw = '{"message": "héllo wörld", "status": "ok"}'
        result = extract_json_from_llm_response(raw)
        assert "héllo" in result["message"]

    def test_deeply_nested_json(self):
        obj = {"l1": {"l2": {"l3": {"l4": "deep"}}}}
        raw = json.dumps(obj)
        result = extract_json_from_llm_response(raw)
        assert result["l1"]["l2"]["l3"]["l4"] == "deep"

    def test_json_with_list_values(self):
        raw = '{"agents": ["root", "sub1", "sub2"], "count": 3}'
        result = extract_json_from_llm_response(raw)
        assert result["count"] == 3
        assert "root" in result["agents"]

    def test_json_with_boolean_and_null_values(self):
        raw = '{"enabled": true, "disabled": false, "missing": null}'
        result = extract_json_from_llm_response(raw)
        assert result["enabled"] is True
        assert result["disabled"] is False
        assert result["missing"] is None

    def test_real_world_gemini_preamble_pattern(self):
        """Simulates Gemini 2.5 Flash adding 'Here is the architecture:' preamble."""
        raw = (
            "Here is the suggested architecture:\n\n"
            "```json\n"
            '{\n'
            '  "agents": [{"name": "Root Agent", "agent_type": "root_agent"}],\n'
            '  "rationale": "Single root handles all routing.",\n'
            '  "decomposition_strategy": "capability_based",\n'
            '  "root_agent_style": "pure_router",\n'
            '  "estimated_complexity": "simple"\n'
            "}\n"
            "```"
        )
        result = extract_json_from_llm_response(raw)
        assert result["decomposition_strategy"] == "capability_based"
        assert result["agents"][0]["name"] == "Root Agent"
