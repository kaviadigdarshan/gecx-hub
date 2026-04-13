"""
AI Service — wraps Gemini 2.5 Flash for all accelerator generation tasks.

Auth priority:
1. GEMINI_API_KEY in .env  → uses google.generativeai (AI Studio, simplest for local dev)
2. ADC + GCP_PROJECT_ID    → uses Vertex AI (for Cloud Run production)
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def _get_backend() -> str:
    return "ai_studio" if os.getenv("GEMINI_API_KEY") else "vertex"


async def generate_text(prompt: str, system_prompt: Optional[str] = None) -> str:
    """Generate text using Gemini 2.5 Flash. Returns the text response."""
    import asyncio

    backend = _get_backend()
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

    if backend == "ai_studio":
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        def _call() -> str:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=8192,
                ),
            )
            return response.text

    else:
        import vertexai
        from vertexai.generative_models import GenerativeModel, GenerationConfig

        project = os.getenv("GCP_PROJECT_ID", "gecx-hub-dev")
        location = os.getenv("GCP_LOCATION", "us-central1")
        vertexai.init(project=project, location=location)
        model = GenerativeModel("gemini-2.5-flash")

        def _call() -> str:  # type: ignore[misc]
            response = model.generate_content(
                full_prompt,
                generation_config=GenerationConfig(temperature=0.7, max_output_tokens=8192),
            )
            return response.text

    try:
        result = await asyncio.to_thread(_call)
        logger.info("AI generation successful via %s, chars=%d", backend, len(result))
        return result
    except Exception as e:
        logger.error("AI generation failed: %s", str(e))
        raise
