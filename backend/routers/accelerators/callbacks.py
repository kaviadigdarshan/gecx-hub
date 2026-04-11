"""Callback Accelerator router: generate ADK callback code per agent hook type."""

import logging

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user_with_token
from models.auth import User
from models.accelerators.callbacks import (
    CallbackGenerateRequest,
    CallbackGenerateResponse,
    CallbackWriteRequest,
    CallbackWriteResponse,
)
from services.callback_service import generate_callbacks
from services.session_store import set_callbacks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accelerators/callbacks", tags=["Callbacks"])


@router.post("/generate", response_model=CallbackGenerateResponse)
async def generate_callback_code(
    request: CallbackGenerateRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> CallbackGenerateResponse:
    """Generate Python callback code for each requested hook type.

    Uses Gemini to customise the ADK stub templates for the agent's name,
    description, and vertical. Falls back to static stubs in DEMO_MODE or
    when Gemini is unavailable.
    """
    user, _ = auth
    logger.info(
        "Callback generate: user=%s agent=%s hooks=%s vertical=%s",
        user.id, request.agentName, request.hookTypes, request.vertical,
    )
    return await generate_callbacks(request)


@router.post("/write-to-scaffold", response_model=CallbackWriteResponse)
async def write_callbacks_to_scaffold(
    request: CallbackWriteRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> CallbackWriteResponse:
    """Store Acc-4 callback code in session state for the next ZIP generation call.

    The scaffolder's /generate endpoint reads this data (keyed by sessionId)
    and writes the Gemini-generated Python code into the AppSnapshot ZIP instead
    of the default callback stubs.
    """
    user, _ = auth
    logger.info(
        "Callback write-to-scaffold: user=%s session=%s agents=%d",
        user.id, request.sessionId, len(request.agentCallbacks),
    )
    set_callbacks(request.sessionId, request.agentCallbacks)
    return CallbackWriteResponse(
        stored=True,
        session_id=request.sessionId,
        agent_count=len(request.agentCallbacks),
    )
