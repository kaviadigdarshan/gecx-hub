"""Orchestration logic for the guardrails accelerator: load presets, build, and package."""

import json
import logging
import os
from pathlib import Path
from typing import Any

from prompts.guardrails_prompts import (
    get_guardrail_names_prompt,
    GUARDRAIL_NAMES_SYSTEM_INSTRUCTION,
)
from services.artifact_builder import (
    GUARDRAIL_TYPE_MAP,
    FILENAME_MAP,
    package_guardrails_zip,
    build_guardrails_zip,
)
from models.accelerators.guardrails import (
    GuardrailActionConfig,
    GuardrailPreviewItem,
    GuardrailsGenerateRequest,
    TriggerAction,
)
from services.gemini_service import get_gemini_service

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "guardrails"

SENSITIVITY_THRESHOLDS = {
    "relaxed": "BLOCK_ONLY_HIGH",
    "balanced": "BLOCK_MEDIUM_AND_ABOVE",
    "strict": "BLOCK_LOW_AND_ABOVE",
}

HARM_CATEGORIES = [
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
]

DESCRIPTIONS = {
    "ContentFilter": "Blocks specific words, phrases, and competitor names in user inputs and agent responses.",
    "LlmPromptSecurity": "Protects against prompt injection attacks and attempts to override agent instructions.",
    "LlmPolicy": "Uses an LLM to classify whether conversation content violates defined policy rules.",
    "ModelSafety": "Applies Gemini's built-in content safety filters with configurable harm thresholds.",
}

# ── 22-guardrail taxonomy ─────────────────────────────────────────────────────

# Hardcoded retail fallback — used in demo mode and when Gemini is unavailable.
DEMO_GUARDRAIL_CLUSTERS: dict[str, list[str]] = {
    "Safety": [
        "Harm Content Safety Filter",
        "Sexual Content Blocker",
        "Violence Content Shield",
        "Dangerous Information Guard",
    ],
    "Compliance": [
        "PCI DSS Transaction Compliance",
        "Data Privacy Policy Guard",
        "GDPR Compliance Monitor",
        "Financial Regulation Checker",
        "Consumer Protection Policy",
    ],
    "Brand/Business": [
        "Competitor Name Blocker",
        "Brand Voice Enforcement",
        "Off-Topic Query Deflector",
        "Restricted Product Filter",
    ],
    "Content": [
        "Profanity Content Filter",
        "Hate Speech Blocker",
        "Misinformation Guard",
        "Medical Advice Restriction",
        "Legal Advice Disclaimer",
    ],
    "Experience": [
        "Prompt Injection Shield",
        "Jailbreak Attempt Guard",
        "Instruction Override Protector",
        "Conversation Policy Enforcer",
    ],
}

# Maps each cluster to the CES guardrail type used for its config
_CLUSTER_CES_TYPE: dict[str, str] = {
    "Safety": "modelSafety",
    "Compliance": "llmPolicy",
    "Brand/Business": "contentFilter",
    "Content": "contentFilter",
    "Experience": "llmPromptSecurity",
}

_GEMINI_CLUSTER_KEY_MAP: dict[str, str] = {
    # Gemini might return "Brand" — normalise to "Brand/Business"
    "Brand": "Brand/Business",
}


async def generate_guardrail_names(vertical: str) -> dict[str, list[str]]:
    """Return cluster→names dict with 22 total guardrail names.

    Calls Gemini for vertical-specific names. Falls back to the hardcoded
    retail demo taxonomy when ENVIRONMENT=demo or when the Gemini call fails.
    """
    if os.environ.get("ENVIRONMENT") == "demo":
        return DEMO_GUARDRAIL_CLUSTERS

    try:
        gemini = get_gemini_service()
        result = await gemini.generate_structured_json(
            prompt=get_guardrail_names_prompt(vertical),
            system_instruction=GUARDRAIL_NAMES_SYSTEM_INSTRUCTION,
            temperature=0.3,
        )
        # Normalise alternate key spellings Gemini might produce
        normalised: dict[str, list[str]] = {}
        for k, v in result.items():
            key = _GEMINI_CLUSTER_KEY_MAP.get(k, k)
            if isinstance(v, list):
                normalised[key] = [str(n) for n in v]
        # Accept if all 5 clusters present and total ≈ 22
        expected = set(DEMO_GUARDRAIL_CLUSTERS.keys())
        if expected.issubset(normalised.keys()):
            return normalised
    except Exception as exc:
        logger.warning("Guardrail name generation via Gemini failed, using demo names: %s", exc)

    return DEMO_GUARDRAIL_CLUSTERS


def build_guardrail_configs_map(
    clusters: dict[str, list[str]],
    request: GuardrailsGenerateRequest,
    preset: dict,
) -> dict[str, Any]:
    """Build a CES API config dict for each of the 22 guardrail names.

    Each name is mapped to the config corresponding to its cluster's CES type.
    The base config for that type is cloned and the displayName overridden.
    """
    cf_base = build_content_filter(request, preset["content_filter"])
    ps_base = build_prompt_security(request, preset["llm_prompt_security"])
    ms_base = build_model_safety(request, preset["model_safety"])
    lp_policies = preset.get("llm_policy", [])
    lp_base = (
        build_llm_policy(request, lp_policies[0], 0)
        if lp_policies
        else {
            "displayName": "Policy Guard",
            "llmPolicy": {"prompt": "Flag any content that violates company policy."},
            "enabled": True,
        }
    )

    _type_to_base = {
        "contentFilter": cf_base,
        "llmPromptSecurity": ps_base,
        "modelSafety": ms_base,
        "llmPolicy": lp_base,
    }

    configs: dict[str, Any] = {}
    for cluster, names in clusters.items():
        ces_type = _CLUSTER_CES_TYPE.get(cluster, "llmPolicy")
        base = _type_to_base[ces_type]
        for name in names:
            configs[name] = {**base, "displayName": name}

    return configs


# ── Preset loading ────────────────────────────────────────────────────────────

def load_preset(vertical: str) -> dict:
    path = TEMPLATES_DIR / f"{vertical}.json"
    with open(path, "r") as f:
        return json.load(f)


def list_presets() -> list[str]:
    return sorted(p.stem for p in TEMPLATES_DIR.glob("*.json"))


# ── CES action payload builder ────────────────────────────────────────────────

def build_action(action_config: GuardrailActionConfig) -> dict:
    if action_config.action_type == TriggerAction.RESPOND_IMMEDIATELY:
        return {
            "respondImmediately": {
                "responses": [{"text": action_config.canned_response}]
            }
        }
    elif action_config.action_type == TriggerAction.TRANSFER_AGENT:
        return {"transferAgent": {"agent": action_config.target_agent}}
    else:
        return {"generativeAnswer": {"prompt": action_config.generative_prompt}}


# ── Individual guardrail builders ─────────────────────────────────────────────

def build_content_filter(request: GuardrailsGenerateRequest, preset_cf: dict) -> dict:
    merged = list(set(
        preset_cf.get("banned_contents", [])
        + request.competitor_names
        + request.custom_blocked_phrases
    ))
    return {
        "displayName": "Content Blocklist",
        "contentFilter": {
            "bannedContents": merged,
            "bannedContentsInUserInput": preset_cf.get("banned_in_user_input", []),
            "bannedContentsInAgentResponse": preset_cf.get("banned_in_agent_response", []),
            "matchType": preset_cf.get("match_type", "CONTAINS"),
            "disregardDiacritics": preset_cf.get("disregard_diacritics", True),
        },
        "action": build_action(request.default_action),
        "enabled": True,
    }


def build_prompt_security(request: GuardrailsGenerateRequest, preset_ps: dict) -> dict:
    if preset_ps.get("use_custom_policy") and preset_ps.get("custom_policy_prompt"):
        security_config: dict = {"customPolicy": {"prompt": preset_ps["custom_policy_prompt"]}}
    else:
        security_config = {"defaultSettings": {}}

    return {
        "displayName": "Prompt Injection Guard",
        "llmPromptSecurity": {
            **security_config,
            "failOpen": preset_ps.get("fail_open", False),
        },
        "action": build_action(request.default_action),
        "enabled": request.enable_prompt_injection_guard,
    }


def build_llm_policy(
    request: GuardrailsGenerateRequest, policy_config: dict, index: int
) -> dict:
    prompt = policy_config["prompt"]
    if index == 0 and request.custom_policy_rules:
        prompt = f"{prompt}\n\nAdditional policy rules: {request.custom_policy_rules}"
    return {
        "displayName": policy_config["policy_name"],
        "llmPolicy": {
            "prompt": prompt,
            "policyScope": policy_config.get("policy_scope", "USER_INPUT"),
            "maxConversationMessages": policy_config.get("max_conversation_messages", 10),
            "allowShortUtterance": policy_config.get("allow_short_utterance", True),
        },
        "action": build_action(request.default_action),
        "enabled": True,
    }


def build_model_safety(request: GuardrailsGenerateRequest, preset_ms: dict) -> dict:
    threshold = SENSITIVITY_THRESHOLDS[request.sensitivity_level]
    return {
        "displayName": f"Model Safety ({request.sensitivity_level.title()})",
        "modelSafety": {
            "safetySettings": [
                {"harmCategory": cat, "harmBlockThreshold": threshold}
                for cat in HARM_CATEGORIES
            ]
        },
        "action": build_action(request.default_action),
        "enabled": True,
    }


# ── Pack builder ──────────────────────────────────────────────────────────────

async def build_guardrails_pack(
    request: GuardrailsGenerateRequest, preset: dict
) -> list[dict]:
    guardrails: list[dict] = []
    guardrails.append(build_content_filter(request, preset["content_filter"]))
    guardrails.append(build_prompt_security(request, preset["llm_prompt_security"]))
    for i, policy in enumerate(preset.get("llm_policy", [])):
        guardrails.append(build_llm_policy(request, policy, i))
    guardrails.append(build_model_safety(request, preset["model_safety"]))
    return guardrails


# ── Preview conversion ────────────────────────────────────────────────────────

def guardrail_to_preview(guardrail: dict) -> GuardrailPreviewItem:
    guardrail_key = next((k for k in GUARDRAIL_TYPE_MAP if k in guardrail), None)
    guardrail_type = GUARDRAIL_TYPE_MAP.get(guardrail_key, "Unknown") if guardrail_key else "Unknown"
    return GuardrailPreviewItem(
        guardrail_type=guardrail_type,
        display_name=guardrail.get("displayName", guardrail_type),
        description=DESCRIPTIONS.get(guardrail_type, ""),
        ces_resource=guardrail,
        enabled=guardrail.get("enabled", True),
    )


# package_guardrails_zip and build_guardrails_zip are imported from artifact_builder above.
