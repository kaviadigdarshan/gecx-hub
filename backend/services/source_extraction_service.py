"""Source extraction service — parses business documents into CES scaffold config."""

import base64
import logging
import os

from fastapi import HTTPException

from models.source_extraction import (
    SourceExtractionError,
    SourceExtractionRequest,
    SourceExtractionResponse,
    SourceExtractionSuccess,
    SourceInputType,
)
from services.ai_service import generate_text
from utils.json_utils import extract_json_from_llm_response

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """You are a CX Agent Studio (CES) implementation analyst specializing in extracting
structured agent configuration from business documents such as Statements of Work,
RFPs, project briefs, and requirements documents.

Your task: analyze the provided document content and extract CES application
configuration parameters as a valid JSON object.

SUPPORTED INDUSTRY VERTICALS:
retail | bfsi | healthcare | telecom | hospitality | ecommerce | utilities | generic

REQUIRED FIELDS (return error object if ANY of these cannot be identified with
high confidence from the document):
  - primary_use_case: The main customer interaction or business process this agent
    system handles. Be specific (e.g. "Handle inbound insurance claim queries and
    route to specialist teams based on claim type"). 1-3 sentences.
  - industry_vertical: Map to the closest of the 8 supported verticals above.
    If unsure, use "generic".
  - root_agent_name: A short, CES-compatible slug for the root/orchestrating agent
    (e.g. "claim_intake_agent", "retail_support_agent"). snake_case, no spaces.
  - root_agent_purpose: What the root agent is responsible for. 1-2 sentences.

OPTIONAL FIELDS (only populate if HIGH-CONFIDENCE evidence exists in the document.
DO NOT infer or hallucinate values not supported by explicit document text):
  - sub_agents: Array of { name (snake_case), purpose (1 sentence),
    tools_needed (string array) }. Only create sub-agents if the document
    explicitly mentions distinct workflows, departments, or handoff scenarios.
  - persona_tone: One word or phrase describing communication style derived from
    brand guidelines, user-facing tone notes, or explicit requirements.
    Values: "professional", "empathetic", "formal", "casual", "technical"
  - in_scope: Array of topic strings the agent should handle. Extract from explicit
    "in scope" sections, capability lists, or functional requirements.
  - out_of_scope: Array of topic strings explicitly excluded in the document.
  - session_variables: Array of { name (UPPER_SNAKE_CASE), description }.
    Look for: data fields to be captured, account/case/order IDs, form inputs,
    lookup keys mentioned in flows.
  - tools_required: Array of { name, description, api_type ("rest"|"graphql"|"grpc") }.
    Look for: API integrations, backend system connections, third-party services.
  - guardrail_topics: Topics that should be restricted per compliance, legal, or
    sensitivity requirements mentioned in the document.
  - blocked_phrases: Specific phrases that should be blocked per document guidance.
  - assumptions: Key implementation assumptions stated explicitly in the document.

CONFIDENCE RULES:
  - HIGH: Explicit statement in the document supports the value directly.
  - MEDIUM: Reasonable inference from multiple related statements.
  - Only include optional fields at HIGH confidence. Never include at LOW confidence.
  - For required fields: if evidence is MEDIUM or lower, include the field in
    missing_required and return an error.

OUTPUT: Return ONLY a valid JSON object. No explanation, no markdown, no preamble.

SUCCESS FORMAT:
{
  "primary_use_case": "...",
  "industry_vertical": "...",
  "root_agent_name": "...",
  "root_agent_purpose": "...",
  "sub_agents": [...],
  "persona_tone": "...",
  "in_scope": [...],
  "out_of_scope": [...],
  "session_variables": [...],
  "tools_required": [...],
  "guardrail_topics": [...],
  "blocked_phrases": [...],
  "assumptions": [...],
  "extraction_confidence": "high"
}

ERROR FORMAT (use when required fields cannot be confidently identified):
{
  "error": true,
  "missing_required": ["primary_use_case", "industry_vertical"],
  "message": "The provided document does not contain enough information to identify [field]. Please provide a document that describes the primary customer interaction use case and the business domain."
}"""

_DEMO_RESULT = SourceExtractionSuccess(
    primary_use_case="Retail order management and returns handling (DEMO)",
    industry_vertical="retail",
    root_agent_name="retail_support_agent",
    root_agent_purpose="Handle order inquiries, track shipments, and process returns.",
    in_scope=["Order status", "Returns", "Product availability"],
    out_of_scope=["Financial advice", "Third-party seller disputes"],
)


async def extract_context(
    request: SourceExtractionRequest,
) -> SourceExtractionResponse:
    """Extract CES scaffold configuration from a business document."""

    # STEP 1 — Resolve text content
    text_content: str | None = None

    if request.input_type == SourceInputType.FILE_UPLOAD:
        if not request.file_content_base64:
            raise HTTPException(
                status_code=400,
                detail="file_content_base64 is required for file_upload input type.",
            )
        file_bytes = base64.b64decode(request.file_content_base64)
        filename = (request.filename or "").lower()

        if filename.endswith(".pdf"):
            try:
                import io
                try:
                    from pypdf import PdfReader
                except ImportError:
                    try:
                        from PyPDF2 import PdfReader  # type: ignore[no-redef]
                    except ImportError:
                        raise HTTPException(
                            status_code=400,
                            detail="PDF parsing requires pypdf: pip install pypdf",
                        )
                reader = PdfReader(io.BytesIO(file_bytes))
                text_content = "\n".join(
                    page.extract_text() or "" for page in reader.pages
                )
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to parse PDF: {exc}",
                ) from exc
        elif filename.endswith(".txt") or filename.endswith(".md"):
            text_content = file_bytes.decode("utf-8")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type for '{request.filename}'. Supported: .pdf, .txt, .md",
            )

    elif request.input_type == SourceInputType.CLIPBOARD_TEXT:
        text_content = request.text_content

    if not text_content or not text_content.strip():
        raise HTTPException(
            status_code=400,
            detail="No text content could be extracted from the provided input.",
        )

    # STEP 2 — Demo mode short-circuit
    if os.getenv("ENVIRONMENT") == "demo":
        return SourceExtractionResponse(success=True, data=_DEMO_RESULT)

    # STEP 2 — Call Gemini via ai_service
    user_message = f"Document content to analyze:\n\n{text_content[:50000]}"

    try:
        raw_json = await generate_text(
            prompt=user_message,
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
        )

        # STEP 3 — Parse Gemini response
        parsed = extract_json_from_llm_response(raw_json)

        if parsed.get("error") is True:
            return SourceExtractionResponse(
                success=False,
                error=SourceExtractionError(**parsed),
            )

        return SourceExtractionResponse(
            success=True,
            data=SourceExtractionSuccess(**parsed),
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Source extraction failed: %s", str(exc))
        return SourceExtractionResponse(
            success=False,
            error=SourceExtractionError(
                error=True,
                missing_required=[],
                message=f"Extraction failed: {exc}",
            ),
        )
