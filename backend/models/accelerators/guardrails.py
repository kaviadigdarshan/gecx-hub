"""Pydantic models for guardrail generation requests and responses."""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel, field_validator

if TYPE_CHECKING:
    from models.project_context import ScaffoldContext


class TriggerAction(str, Enum):
    RESPOND_IMMEDIATELY = "RESPOND_IMMEDIATELY"
    TRANSFER_AGENT = "TRANSFER_AGENT"
    GENERATIVE_ANSWER = "GENERATIVE_ANSWER"


class GuardrailActionConfig(BaseModel):
    action_type: TriggerAction
    canned_response: str | None = None
    target_agent: str | None = None
    generative_prompt: str | None = None

    @field_validator("canned_response")
    @classmethod
    def require_canned_response(cls, v, info):
        if info.data.get("action_type") == TriggerAction.RESPOND_IMMEDIATELY and not v:
            raise ValueError(
                "canned_response is required when action_type is RESPOND_IMMEDIATELY"
            )
        return v


class GuardrailsGenerateRequest(BaseModel):
    industry_vertical: Literal[
        "retail", "bfsi", "healthcare", "telecom",
        "hospitality", "ecommerce", "utilities", "generic"
    ]
    project_id: str | None = None   # when set, guardrailNames are written back to ScaffoldContext
    agent_persona_type: Literal[
        "customer_service", "order_management", "booking",
        "payment_support", "technical_support", "hr_assistant"
    ]
    sensitivity_level: Literal["relaxed", "balanced", "strict"] = "balanced"
    competitor_names: list[str] = []
    custom_blocked_phrases: list[str] = []
    custom_policy_rules: str = ""
    enable_prompt_injection_guard: bool = True
    default_action: GuardrailActionConfig

    @field_validator("competitor_names")
    @classmethod
    def clean_competitor_names(cls, v: list[str]) -> list[str]:
        return list(set(name.strip().lower() for name in v if name.strip()))[:20]

    @field_validator("custom_blocked_phrases")
    @classmethod
    def clean_blocked_phrases(cls, v: list[str]) -> list[str]:
        return list(set(phrase.strip() for phrase in v if phrase.strip()))[:50]

    @field_validator("custom_policy_rules")
    @classmethod
    def limit_policy_rules(cls, v: str) -> str:
        return v.strip()[:1000]


class GuardrailPreviewItem(BaseModel):
    guardrail_type: str
    display_name: str
    description: str
    ces_resource: dict
    enabled: bool = True


class GuardrailsGenerateResponse(BaseModel):
    request_id: str
    previews: list[GuardrailPreviewItem]
    download_url: str
    zip_filename: str
    apply_ready: bool = False
    industry_preset_used: str
    generation_timestamp: str
    guardrail_names: list[str] = []             # 22 names across 5 clusters
    guardrail_configs: dict[str, Any] = {}      # guardrail name → CES API config
    configs_by_cluster: dict[str, list[str]] = {}  # cluster → list of names
    updated_scaffold_context: Any | None = None  # ScaffoldContext if project_id was provided


class GuardrailsApplyRequest(BaseModel):
    project_id: str
    location: str = "us-central1"
    app_id: str
    guardrails: list[dict]


class GuardrailApplyResult(BaseModel):
    guardrail_type: str
    status: Literal["success", "failed"]
    resource_name: str | None = None
    error: str | None = None


class GuardrailsApplyResponse(BaseModel):
    applied_count: int
    failed_count: int
    version_id: str | None
    results: list[GuardrailApplyResult]
