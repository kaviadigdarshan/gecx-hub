# NOTE: Auth priority:
# 1. GEMINI_API_KEY in .env  → AI Studio (google.generativeai), best for local dev
# 2. ADC + GCP_PROJECT_ID    → Vertex AI (vertexai), used in Cloud Run production

"""Gemini API client for generative tasks (guardrail generation, suggestions)."""

import asyncio
import json
import logging
import os
from functools import lru_cache

from fastapi import HTTPException
from google.api_core.exceptions import (
    InvalidArgument,
    PermissionDenied,
    ResourceExhausted,
    ServiceUnavailable,
)

from config import get_settings
from utils.json_utils import extract_json_from_llm_response

logger = logging.getLogger(__name__)

_RETRYABLE = (ResourceExhausted, ServiceUnavailable)
_NON_RETRYABLE = (InvalidArgument, PermissionDenied)


class GeminiService:

    def __init__(self) -> None:
        settings = get_settings()
        self.model_name = settings.gemini_model  # "gemini-2.5-flash"
        self._api_key = os.getenv("GEMINI_API_KEY")

        if self._api_key:
            self._backend = "ai_studio"
            logger.info(
                "GeminiService: using Gemini 2.5 Flash via AI Studio (API key)"
            )
        else:
            import vertexai
            from vertexai.generative_models import GenerativeModel
            vertexai.init(
                project=settings.gcp_project_id, location=settings.gcp_location
            )
            self._backend = "vertex"
            self._vertex_model = GenerativeModel(self.model_name)
            logger.info(
                "GeminiService: using Gemini 2.5 Flash via Vertex AI (ADC), project=%s",
                settings.gcp_project_id,
            )

    async def _run(
        self,
        prompt: str,
        system_instruction: str | None,
        temperature: float,
        max_output_tokens: int,
        response_mime_type: str | None = None,
    ) -> str:
        """Dispatch a single Gemini call in a thread pool.

        Uses AI Studio (google.generativeai) if GEMINI_API_KEY is set,
        otherwise falls through to Vertex AI with ADC.

        Raises raw Google API exceptions so callers can decide whether to
        retry or wrap them. Does NOT catch exceptions.
        """
        if self._backend == "ai_studio":
            from google import genai
            from google.genai import types

            full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
            client = genai.Client(api_key=self._api_key)

            config_kwargs: dict = {
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
            }
            if response_mime_type:
                config_kwargs["response_mime_type"] = response_mime_type

            def _call() -> str:
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                return response.text

        else:
            # Vertex AI path
            from vertexai.generative_models import GenerativeModel, GenerationConfig

            if system_instruction:
                model = GenerativeModel(
                    self.model_name, system_instruction=system_instruction
                )
            else:
                model = self._vertex_model

            gen_config_kwargs: dict = {
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
                "candidate_count": 1,
                "stop_sequences": [],
            }
            if response_mime_type:
                gen_config_kwargs["response_mime_type"] = response_mime_type

            generation_config = GenerationConfig(**gen_config_kwargs)

            def _call() -> str:  # type: ignore[misc]
                response = model.generate_content(
                    prompt, generation_config=generation_config
                )
                return response.text

        return (await asyncio.to_thread(_call)).strip()

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.4,
        max_output_tokens: int = 2048,
    ) -> str:
        """Generate text from a prompt. Returns the text of the first candidate.

        Runs the Gemini call in a thread pool via asyncio.to_thread().
        On any API error, logs and raises HTTPException 502.
        """
        try:
            return await self._run(prompt, system_instruction, temperature, max_output_tokens)
        except Exception as exc:
            logger.error("Gemini generation error (%s): %s", self._backend, exc)
            raise HTTPException(
                status_code=502,
                detail="AI generation service temporarily unavailable. Please try again.",
            ) from exc

    async def generate_structured_json(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.2,
    ) -> dict:
        """Generate JSON-structured output.

        Appends a strict JSON-only instruction to the prompt, calls generate_text(),
        then parses with json.loads(). Raises HTTPException 422 on parse failure.
        """
        json_prompt = (
            f"{prompt}\n\n"
            "Respond ONLY with valid JSON. No markdown, no backticks, "
            "no explanation. Just the raw JSON object."
        )

        try:
            raw = await self._run(
                prompt=json_prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                max_output_tokens=8192,
                response_mime_type="application/json",
            )
        except Exception as exc:
            logger.error("Gemini generation error (%s): %s", self._backend, exc)
            raise HTTPException(
                status_code=502,
                detail="AI generation service temporarily unavailable. Please try again.",
            ) from exc

        try:
            return extract_json_from_llm_response(raw)
        except ValueError:
            logger.error(
                "Gemini returned invalid JSON. First 300 chars: %s", raw[:300]
            )
            raise HTTPException(
                status_code=422,
                detail=(
                    "AI returned invalid JSON structure. Please try again. "
                    f"(Response preview: {raw[:200]!r})"
                ),
            )

    async def generate_with_retry(
        self,
        prompt: str,
        system_instruction: str | None = None,
        max_retries: int = 3,
        **kwargs,
    ) -> str:
        """Call generate_text with exponential backoff retry.

        Retries on ResourceExhausted (429) and ServiceUnavailable (503).
        Does not retry on InvalidArgument or PermissionDenied.
        Backoff delays: 1s, 2s, 4s. Raises the last exception after max_retries.
        """
        temperature: float = kwargs.get("temperature", 0.4)
        max_output_tokens: int = kwargs.get("max_output_tokens", 2048)

        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
                return await self._run(
                    prompt, system_instruction, temperature, max_output_tokens
                )
            except _NON_RETRYABLE:
                return await self.generate_text(
                    prompt, system_instruction, temperature, max_output_tokens
                )
            except _RETRYABLE as exc:
                last_exc = exc
                delay = 2 ** attempt
                logger.warning(
                    "Retryable Gemini error (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1, max_retries, delay, exc,
                )
                await asyncio.sleep(delay)
            except Exception as exc:
                last_exc = exc
                delay = 2 ** attempt
                logger.warning(
                    "Unexpected Gemini error (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1, max_retries, delay, exc,
                )
                await asyncio.sleep(delay)

        assert last_exc is not None
        raise last_exc


@lru_cache(maxsize=1)
def get_gemini_service() -> GeminiService:
    return GeminiService()
