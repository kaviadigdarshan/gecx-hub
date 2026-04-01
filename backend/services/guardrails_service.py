"""Orchestration logic for the guardrails accelerator: load presets, build, and package."""

import io
import json
import zipfile
from pathlib import Path

from models.accelerators.guardrails import (
    GuardrailActionConfig,
    GuardrailPreviewItem,
    GuardrailsGenerateRequest,
    TriggerAction,
)

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

GUARDRAIL_TYPE_MAP = {
    "contentFilter": "ContentFilter",
    "llmPromptSecurity": "LlmPromptSecurity",
    "llmPolicy": "LlmPolicy",
    "modelSafety": "ModelSafety",
}

DESCRIPTIONS = {
    "ContentFilter": "Blocks specific words, phrases, and competitor names in user inputs and agent responses.",
    "LlmPromptSecurity": "Protects against prompt injection attacks and attempts to override agent instructions.",
    "LlmPolicy": "Uses an LLM to classify whether conversation content violates defined policy rules.",
    "ModelSafety": "Applies Gemini's built-in content safety filters with configurable harm thresholds.",
}

FILENAME_MAP = {
    "ContentFilter": "content_filter.json",
    "LlmPromptSecurity": "prompt_guard.json",
    "LlmPolicy": "llm_policy",
    "ModelSafety": "model_safety.json",
}


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


# ── ZIP packaging ─────────────────────────────────────────────────────────────

def generate_readme(industry: str, guardrail_count: int) -> str:
    return f"""# Guardrails Pack — {industry.upper()} Preset

Generated by GECX Accelerator Hub
Industry: {industry.title()}
Guardrail count: {guardrail_count}

## How to Import

### Option 1: Via CX Agent Studio Console
1. Open your App in the CX Agent Studio console (ces.cloud.google.com)
2. Navigate to Guardrails section
3. Use the import function to upload each JSON file

### Option 2: Via CES REST API
For each JSON file, call:
  POST https://ces.googleapis.com/v1/projects/{{PROJECT}}/locations/{{LOCATION}}/apps/{{APP_ID}}/guardrails
  Authorization: Bearer YOUR_ACCESS_TOKEN
  Content-Type: application/json
  Body: <contents of the JSON file>

## Included Guardrails
- content_filter.json — ContentFilter (blocklist)
- prompt_guard.json — LlmPromptSecurity (injection protection)
- llm_policy_*.json — LlmPolicy (policy classification)
- model_safety.json — ModelSafety (Gemini harm filters)

Always create a version snapshot of your App before applying guardrails.
"""


async def package_guardrails_zip(guardrails: list[dict], industry: str) -> bytes:
    buffer = io.BytesIO()
    llm_policy_index = 0
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for guardrail in guardrails:
            guardrail_key = next((k for k in GUARDRAIL_TYPE_MAP if k in guardrail), None)
            guardrail_type = GUARDRAIL_TYPE_MAP.get(guardrail_key, "unknown") if guardrail_key else "unknown"
            if guardrail_type == "LlmPolicy":
                llm_policy_index += 1
                filename = f"guardrails_pack/llm_policy_{llm_policy_index}.json"
            else:
                filename = f"guardrails_pack/{FILENAME_MAP.get(guardrail_type, 'guardrail.json')}"
            zf.writestr(filename, json.dumps(guardrail, indent=2))
        zf.writestr(
            "guardrails_pack/README.md",
            generate_readme(industry, len(guardrails)),
        )
    buffer.seek(0)
    return buffer.read()
