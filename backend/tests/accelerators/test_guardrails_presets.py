"""Tests for loading and validating all 8 industry guardrail presets."""

import pytest

from services.guardrails_service import list_presets, load_preset

ALL_VERTICALS = [
    "retail",
    "bfsi",
    "healthcare",
    "telecom",
    "hospitality",
    "ecommerce",
    "utilities",
    "generic",
]

REQUIRED_TOP_LEVEL_KEYS = {
    "content_filter",
    "llm_prompt_security",
    "llm_policy",
    "model_safety",
}

REQUIRED_CF_KEYS = {"banned_contents", "match_type"}
REQUIRED_PS_KEYS = {"fail_open"}
REQUIRED_POLICY_KEYS = {"policy_name", "prompt"}


# ── TestIndustryPresets ───────────────────────────────────────────────────────

class TestIndustryPresets:

    def test_list_presets_returns_all_eight(self):
        presets = list_presets()
        assert set(presets) == set(ALL_VERTICALS)

    def test_list_presets_returns_sorted_list(self):
        presets = list_presets()
        assert presets == sorted(presets)

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_preset_has_required_top_level_keys(self, vertical):
        preset = load_preset(vertical)
        for key in REQUIRED_TOP_LEVEL_KEYS:
            assert key in preset, f"{vertical}: missing key '{key}'"

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_content_filter_has_required_fields(self, vertical):
        cf = load_preset(vertical)["content_filter"]
        for key in REQUIRED_CF_KEYS:
            assert key in cf, f"{vertical}/content_filter: missing key '{key}'"

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_content_filter_banned_contents_is_list(self, vertical):
        cf = load_preset(vertical)["content_filter"]
        assert isinstance(cf["banned_contents"], list)

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_llm_prompt_security_has_fail_open_field(self, vertical):
        ps = load_preset(vertical)["llm_prompt_security"]
        assert "fail_open" in ps

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_llm_policy_is_non_empty_list(self, vertical):
        policies = load_preset(vertical)["llm_policy"]
        assert isinstance(policies, list)
        assert len(policies) >= 1, f"{vertical}: llm_policy must have at least one entry"

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_each_llm_policy_entry_has_required_keys(self, vertical):
        policies = load_preset(vertical)["llm_policy"]
        for i, policy in enumerate(policies):
            for key in REQUIRED_POLICY_KEYS:
                assert key in policy, (
                    f"{vertical}/llm_policy[{i}]: missing key '{key}'"
                )

    @pytest.mark.parametrize("vertical", ALL_VERTICALS)
    def test_model_safety_key_exists(self, vertical):
        ms = load_preset(vertical)["model_safety"]
        assert isinstance(ms, dict)

    def test_bfsi_preset_has_strict_sensitivity_hint(self):
        # BFSI preset uses a custom_policy_prompt indicating stricter policy
        ps = load_preset("bfsi")["llm_prompt_security"]
        assert ps.get("use_custom_policy") is True or "custom_policy_prompt" in ps

    def test_retail_preset_loads_without_error(self, retail_preset):
        assert retail_preset is not None
        assert "content_filter" in retail_preset

    def test_bfsi_preset_loads_without_error(self, bfsi_preset):
        assert bfsi_preset is not None
        assert "content_filter" in bfsi_preset

    def test_load_preset_unknown_vertical_raises(self):
        with pytest.raises(FileNotFoundError):
            load_preset("nonexistent_vertical")
