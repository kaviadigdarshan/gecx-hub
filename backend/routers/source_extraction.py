"""Source extraction router: extract accelerator-scoped fields from pasted text."""

import logging

from fastapi import APIRouter, Depends, Form

from auth.dependencies import get_current_user
from models.auth import User
from models.source_context import ExtractedField, SourceExtractionResult
from services.ai_service import generate_text
from utils.json_utils import extract_json_from_llm_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/source-extraction", tags=["Source Extraction"])

# Fields scoped per accelerator — drives the extraction prompt
ACCELERATOR_FIELDS: dict[str, list[str]] = {
    "scaffolder": [
        "primary_use_case",
        "industry_vertical",
        "root_agent_name",
        "root_agent_purpose",
        "sub_agents",
        "session_variables",
        "tools_required",
    ],
    "instructions": [
        "agent_name",
        "agent_purpose",
        "persona_tone",
        "in_scope",
        "out_of_scope",
        "example_phrases",
    ],
    "guardrails": [
        "guardrail_topics",
        "blocked_phrases",
        "sensitivity_level",
        "industry_vertical",
    ],
}

_EXTRACTION_SYSTEM_PROMPT = """You are a CX Agent Studio (CES) configuration analyst.
Extract the requested fields from the provided text. Return ONLY a valid JSON array.
Each element must have: field_name, value (string), confidence ("high"|"medium"|"low"),
source_snippet (verbatim excerpt from the text that supports the value, max 120 chars).
Only include fields where you found supporting evidence. Never hallucinate values."""


@router.post("/extract", response_model=SourceExtractionResult)
async def extract_from_source(
    source_text: str = Form(...),
    target_accelerator: str = Form(...),
    current_user: User = Depends(get_current_user),
) -> SourceExtractionResult:
    fields_to_extract = ACCELERATOR_FIELDS.get(target_accelerator, [])

    prompt = (
        f"Extract these fields from the text below: {', '.join(fields_to_extract)}\n\n"
        f"Text:\n{source_text[:40000]}"
    )

    raw = await generate_text(prompt=prompt, system_prompt=_EXTRACTION_SYSTEM_PROMPT)
    parsed = extract_json_from_llm_response(raw)

    extracted: list[ExtractedField] = []
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict) and "field_name" in item and "value" in item:
                extracted.append(
                    ExtractedField(
                        field_name=item["field_name"],
                        value=str(item["value"]),
                        confidence=item.get("confidence", "medium"),
                        source_snippet=item.get("source_snippet", ""),
                    )
                )

    return SourceExtractionResult(
        fields=extracted,
        raw_text_length=len(source_text),
        target_accelerator=target_accelerator,
    )
