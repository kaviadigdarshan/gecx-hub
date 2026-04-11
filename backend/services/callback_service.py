"""Callback Accelerator service: generate ADK callback code for each hook type."""

import logging
import os
import re

from models.accelerators.callbacks import CallbackGenerateRequest, CallbackGenerateResponse
from services.ai_service import generate_text
from services.scaffolder_service import _CALLBACK_STUBS

CALLBACK_PROMPTS: dict[str, str] = {
    "beforeAgent": (
        "You are writing a CX Agent Studio before_agent_callback for a {vertical} agent"
        ' named "{agentName}" ({agentDescription}).'
        " The agent uses these session variables: {variable_names}."
        " Write a Python before_agent_callback(callback_context) function that:"
        " 1. Sets callback_context.variables['session_id'] = callback_context.session_id"
        " 2. Initialises any relevant session variables to safe defaults"
        " 3. Returns None (does not intercept the agent)"
        " Return ONLY the Python code with correct imports. No markdown fences."
    ),
    "afterModel": (
        'Write an after_model_callback for {vertical} agent "{agentName}".'
        " It should check callback_context.state for 'custom_output' and if present,"
        " append it as a JSON Part to the LlmResponse. Return ONLY Python code."
    ),
    "afterTool": (
        'Write an after_tool_callback for {vertical} agent "{agentName}".'
        " It should concatenate multi-part tool responses into a single text response."
        " Return ONLY Python code with correct imports."
    ),
    "beforeModel": (
        "Write a before_model_callback for the root agent of a {vertical} app."
        " It should set session_id in variables unless ENV=dev. Return ONLY Python code."
    ),
    "afterAgent": (
        'Write an after_agent_callback for {vertical} agent "{agentName}".'
        " It reads 'custom_output' from variables and returns it as a JSON Content Part."
        " Return ONLY Python code with correct imports."
    ),
}

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an expert Google ADK (Agent Development Kit) engineer. "
    "Generate clean, production-ready Python callback code for a CX Agent Studio agent. "
    "Return only the Python source code — no markdown fences, no explanation."
)


def _extract_code(raw: str) -> str:
    """Strip markdown fences if Gemini returns them despite instructions."""
    raw = raw.strip()
    fenced = re.match(r"```(?:python)?\s*\n([\s\S]*?)```", raw)
    if fenced:
        return fenced.group(1).strip()
    return raw


async def generate_callbacks(request: CallbackGenerateRequest) -> CallbackGenerateResponse:
    """Generate callback code for each requested hook type.

    In DEMO_MODE returns the static stubs from scaffolder_service unchanged.
    Falls back to stubs if Gemini fails for any individual hook.
    """
    variable_names = [v.name for v in request.variableDeclarations]
    is_demo = os.environ.get("ENVIRONMENT") == "demo"

    if is_demo:
        callbacks = {h: _CALLBACK_STUBS[h] for h in request.hookTypes if h in _CALLBACK_STUBS}
        logger.info(
            "Callback generation (demo): agent=%s hooks=%s",
            request.agentName, list(callbacks.keys()),
        )
        return CallbackGenerateResponse(callbacks=callbacks, demo_mode=True)

    callbacks: dict[str, str] = {}
    for hook_type in request.hookTypes:
        stub = _CALLBACK_STUBS.get(hook_type)
        if stub is None:
            logger.warning("Unknown hook type skipped: %s", hook_type)
            continue
        template = CALLBACK_PROMPTS.get(hook_type)
        if template is None:
            logger.warning("No prompt template for hook %s (using stub): ", hook_type)
            callbacks[hook_type] = stub
            continue
        prompt = template.format(
            vertical=request.vertical,
            agentName=request.agentName,
            agentDescription=request.agentDescription,
            variable_names=", ".join(variable_names) if variable_names else "none",
        )
        try:
            raw = await generate_text(prompt, system_prompt=_SYSTEM_PROMPT)
            callbacks[hook_type] = _extract_code(raw)
            logger.info(
                "Callback generated via Gemini: agent=%s hook=%s chars=%d",
                request.agentName, hook_type, len(callbacks[hook_type]),
            )
        except Exception as exc:
            logger.warning(
                "Gemini failed for hook %s (using stub): %s", hook_type, exc
            )
            callbacks[hook_type] = stub

    return CallbackGenerateResponse(callbacks=callbacks, demo_mode=False)
