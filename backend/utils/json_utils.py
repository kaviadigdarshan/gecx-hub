"""Utilities for extracting valid JSON from LLM responses.

LLMs sometimes wrap JSON in markdown code fences or add preamble text even
when instructed not to. This module provides a robust extraction function
that handles those cases gracefully.
"""

import json
import re
import logging

logger = logging.getLogger(__name__)


def extract_json_from_llm_response(raw: str) -> dict:
    """Extract and parse a JSON object from an LLM response string.

    Handles the following response formats:
    1. Raw JSON (ideal case)
    2. JSON wrapped in ```json ... ``` fences
    3. JSON wrapped in ``` ... ``` fences (no language tag)
    4. Preamble text followed by a fenced JSON block
    5. Preamble text followed by a bare JSON object (starts with '{')

    Args:
        raw: The raw string returned by the LLM.

    Returns:
        Parsed JSON as a dict.

    Raises:
        ValueError: If no valid JSON object could be extracted.
    """
    text = raw.strip()

    # Strategy 1: direct parse (best case — response_mime_type worked)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: extract from fenced code block (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*\n([\s\S]*?)\n```", text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Strategy 3: find the first '{' and try to parse from there
    brace_idx = text.find("{")
    if brace_idx != -1:
        candidate = text[brace_idx:]
        # Trim any trailing text after the last closing brace
        last_brace = candidate.rfind("}")
        if last_brace != -1:
            candidate = candidate[: last_brace + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Strategy 4: line-by-line accumulation — find first line starting with '{'
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("{"):
            candidate = "\n".join(lines[i:])
            last_brace = candidate.rfind("}")
            if last_brace != -1:
                candidate = candidate[: last_brace + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                break

    logger.error(
        "extract_json_from_llm_response: all strategies failed. "
        "First 300 chars of raw response: %s",
        raw[:300],
    )
    raise ValueError(
        f"Could not extract valid JSON from LLM response. "
        f"Response preview: {raw[:300]!r}"
    )
