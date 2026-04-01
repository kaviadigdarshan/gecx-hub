"""Unit tests for guardrails_service builder functions."""

import io
import json
import zipfile

import pytest

from models.accelerators.guardrails import (
    GuardrailActionConfig,
    GuardrailsGenerateRequest,
    TriggerAction,
)
from services.guardrails_service import (
    HARM_CATEGORIES,
    SENSITIVITY_THRESHOLDS,
    build_action,
    build_content_filter,
    build_guardrails_pack,
    build_llm_policy,
    build_model_safety,
    package_guardrails_zip,
)


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_request(**overrides) -> GuardrailsGenerateRequest:
    defaults = dict(
        industry_vertical="retail",
        agent_persona_type="customer_service",
        sensitivity_level="balanced",
        competitor_names=["rivalcorp"],
        custom_blocked_phrases=["hate speech"],
        custom_policy_rules="",
        enable_prompt_injection_guard=True,
        default_action=GuardrailActionConfig(
            action_type=TriggerAction.RESPOND_IMMEDIATELY,
            canned_response="I cannot assist with that request.",
        ),
    )
    defaults.update(overrides)
    return GuardrailsGenerateRequest(**defaults)


MINIMAL_PRESET_CF = {
    "banned_contents": ["violence", "abuse"],
    "banned_in_user_input": [],
    "banned_in_agent_response": [],
    "match_type": "CONTAINS",
    "disregard_diacritics": True,
}

MINIMAL_PRESET_MS = {}

MINIMAL_POLICY_CONFIG = {
    "policy_name": "Retail Policy",
    "prompt": "Flag any content that violates retail policy.",
    "policy_scope": "USER_INPUT",
    "max_conversation_messages": 10,
    "allow_short_utterance": True,
}


# ── TestBuildAction ───────────────────────────────────────────────────────────

class TestBuildAction:

    def test_respond_immediately_action_structure(self):
        action = GuardrailActionConfig(
            action_type=TriggerAction.RESPOND_IMMEDIATELY,
            canned_response="Sorry, I can't help with that.",
        )
        result = build_action(action)
        assert "respondImmediately" in result
        assert result["respondImmediately"]["responses"][0]["text"] == "Sorry, I can't help with that."

    def test_transfer_agent_action_structure(self):
        action = GuardrailActionConfig(
            action_type=TriggerAction.TRANSFER_AGENT,
            target_agent="escalation-agent",
        )
        result = build_action(action)
        assert "transferAgent" in result
        assert result["transferAgent"]["agent"] == "escalation-agent"

    def test_generative_answer_action_structure(self):
        action = GuardrailActionConfig(
            action_type=TriggerAction.GENERATIVE_ANSWER,
            generative_prompt="Generate a polite refusal.",
        )
        result = build_action(action)
        assert "generativeAnswer" in result
        assert result["generativeAnswer"]["prompt"] == "Generate a polite refusal."


# ── TestBuildContentFilter ────────────────────────────────────────────────────

class TestBuildContentFilter:

    def test_content_filter_has_correct_display_name(self, sample_request):
        result = build_content_filter(sample_request, MINIMAL_PRESET_CF)
        assert result["displayName"] == "Content Blocklist"

    def test_content_filter_merges_preset_and_custom_phrases(self):
        request = _make_request(
            competitor_names=["acme"],
            custom_blocked_phrases=["violence"],
        )
        result = build_content_filter(request, MINIMAL_PRESET_CF)
        banned = result["contentFilter"]["bannedContents"]
        # preset has ["violence", "abuse"], custom adds "violence" (deduped), competitor adds "acme"
        assert "acme" in banned
        assert "abuse" in banned

    def test_content_filter_deduplicates_banned_contents(self):
        request = _make_request(custom_blocked_phrases=["violence"])
        result = build_content_filter(request, MINIMAL_PRESET_CF)
        banned = result["contentFilter"]["bannedContents"]
        # "violence" appears in both preset and custom_blocked_phrases — must appear exactly once
        assert banned.count("violence") == 1

    def test_content_filter_uses_preset_match_type(self):
        preset_cf = {**MINIMAL_PRESET_CF, "match_type": "EXACT"}
        result = build_content_filter(_make_request(), preset_cf)
        assert result["contentFilter"]["matchType"] == "EXACT"

    def test_content_filter_enabled_flag_is_true(self, sample_request):
        result = build_content_filter(sample_request, MINIMAL_PRESET_CF)
        assert result["enabled"] is True


# ── TestBuildModelSafety ──────────────────────────────────────────────────────

class TestBuildModelSafety:

    def test_model_safety_contains_all_harm_categories(self, sample_request):
        result = build_model_safety(sample_request, MINIMAL_PRESET_MS)
        categories_in_result = [
            s["harmCategory"]
            for s in result["modelSafety"]["safetySettings"]
        ]
        for cat in HARM_CATEGORIES:
            assert cat in categories_in_result

    def test_model_safety_threshold_for_balanced(self):
        request = _make_request(sensitivity_level="balanced")
        result = build_model_safety(request, MINIMAL_PRESET_MS)
        thresholds = {
            s["harmCategory"]: s["harmBlockThreshold"]
            for s in result["modelSafety"]["safetySettings"]
        }
        for cat in HARM_CATEGORIES:
            assert thresholds[cat] == SENSITIVITY_THRESHOLDS["balanced"]

    def test_model_safety_threshold_for_strict(self):
        request = _make_request(sensitivity_level="strict")
        result = build_model_safety(request, MINIMAL_PRESET_MS)
        thresholds = {
            s["harmCategory"]: s["harmBlockThreshold"]
            for s in result["modelSafety"]["safetySettings"]
        }
        for cat in HARM_CATEGORIES:
            assert thresholds[cat] == SENSITIVITY_THRESHOLDS["strict"]

    def test_model_safety_display_name_includes_sensitivity(self):
        request = _make_request(sensitivity_level="relaxed")
        result = build_model_safety(request, MINIMAL_PRESET_MS)
        assert "Relaxed" in result["displayName"]


# ── TestBuildLlmPolicy ────────────────────────────────────────────────────────

class TestBuildLlmPolicy:

    def test_llm_policy_uses_policy_name_as_display_name(self, sample_request):
        result = build_llm_policy(sample_request, MINIMAL_POLICY_CONFIG, index=0)
        assert result["displayName"] == MINIMAL_POLICY_CONFIG["policy_name"]

    def test_llm_policy_appends_custom_rules_to_first_policy(self):
        request = _make_request(custom_policy_rules="Never discuss refund policies.")
        result = build_llm_policy(request, MINIMAL_POLICY_CONFIG, index=0)
        assert "Never discuss refund policies." in result["llmPolicy"]["prompt"]

    def test_llm_policy_does_not_append_custom_rules_to_non_first(self):
        request = _make_request(custom_policy_rules="Never discuss refund policies.")
        result = build_llm_policy(request, MINIMAL_POLICY_CONFIG, index=1)
        assert "Never discuss refund policies." not in result["llmPolicy"]["prompt"]


# ── TestBuildGuardrailsPack ───────────────────────────────────────────────────

class TestBuildGuardrailsPack:

    @pytest.mark.asyncio
    async def test_pack_contains_content_filter(self, retail_preset, sample_request):
        pack = await build_guardrails_pack(sample_request, retail_preset)
        types = [list(g.keys()) for g in pack]
        assert any("contentFilter" in t for t in types)

    @pytest.mark.asyncio
    async def test_pack_contains_model_safety(self, retail_preset, sample_request):
        pack = await build_guardrails_pack(sample_request, retail_preset)
        types = [list(g.keys()) for g in pack]
        assert any("modelSafety" in t for t in types)

    @pytest.mark.asyncio
    async def test_pack_contains_at_least_one_llm_policy_for_retail(self, retail_preset, sample_request):
        pack = await build_guardrails_pack(sample_request, retail_preset)
        types = [list(g.keys()) for g in pack]
        assert any("llmPolicy" in t for t in types)

    @pytest.mark.asyncio
    async def test_pack_prompt_security_disabled_when_flag_off(self, retail_preset):
        request = _make_request(enable_prompt_injection_guard=False)
        pack = await build_guardrails_pack(request, retail_preset)
        ps_items = [g for g in pack if "llmPromptSecurity" in g]
        assert len(ps_items) == 1
        assert ps_items[0]["enabled"] is False


# ── TestPackageGuardrailsZip ──────────────────────────────────────────────────

class TestPackageGuardrailsZip:

    @pytest.mark.asyncio
    async def test_zip_is_valid_and_contains_readme(self, retail_preset, sample_request):
        pack = await build_guardrails_pack(sample_request, retail_preset)
        zip_bytes = await package_guardrails_zip(pack, "retail")
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            names = zf.namelist()
        assert "guardrails_pack/README.md" in names

    @pytest.mark.asyncio
    async def test_zip_each_guardrail_is_valid_json(self, retail_preset, sample_request):
        pack = await build_guardrails_pack(sample_request, retail_preset)
        zip_bytes = await package_guardrails_zip(pack, "retail")
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            for name in zf.namelist():
                if name.endswith(".json"):
                    data = json.loads(zf.read(name))
                    assert isinstance(data, dict)
