"""Instructions accelerator router: generate, assemble, and push agent instructions."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user_with_token
from config import get_settings
from models.auth import User
from models.accelerators.instructions import (
    AssembleInstructionRequest,
    AssembleInstructionResponse,
    GenerateSectionRequest,
    GenerateSectionResponse,
    PushInstructionRequest,
    PushInstructionResponse,
)
from services.ces_service import get_ces_service
from services.instruction_service import assemble_full_instruction, generate_section

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accelerators/instructions", tags=["Instructions"])


@router.post("/generate-section", response_model=GenerateSectionResponse)
async def generate_instruction_section(
    request: GenerateSectionRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> GenerateSectionResponse:
    """Generate a single XML section of an agent instruction using Gemini.

    Called once per section as the user progresses through the wizard.
    """
    return await generate_section(request)


@router.post("/assemble", response_model=AssembleInstructionResponse)
async def assemble_instruction(
    request: AssembleInstructionRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> AssembleInstructionResponse:
    """Assemble all sections into a final instruction string with quality scoring.

    Called when the user reaches the final Preview step.
    """
    return await assemble_full_instruction(request)


@router.post("/push", response_model=PushInstructionResponse)
async def push_instruction_to_agent(
    request: PushInstructionRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> PushInstructionResponse:
    """Apply the assembled instruction to a CX Agent Studio agent via the CES API.

    Creates a version snapshot first if create_version_first=True (non-fatal if it fails).
    """
    user, access_token = auth
    ces = get_ces_service()
    version_id: str | None = None

    existing_agent = await ces.get_agent(
        request.project_id, request.location, request.app_id,
        request.agent_id, access_token,
    )
    previous_instruction: str = existing_agent.get("instruction", "")

    if request.create_version_first:
        snapshot_name = (
            f"pre-instruction-update-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        )
        try:
            version = await ces.create_version(
                request.project_id, request.location, request.app_id,
                snapshot_name, access_token,
            )
            raw_name: str = version.get("name", "")
            version_id = raw_name.split("/")[-1] if raw_name else None
            if version_id:
                logger.info("Version snapshot created: %s", version_id)
        except Exception as exc:
            logger.warning("Version snapshot failed (continuing): %s", exc)

    updated_agent = await ces.update_agent_instruction(
        request.project_id, request.location, request.app_id,
        request.agent_id, request.instruction, access_token,
    )

    logger.info(
        "Instruction applied: user=%s agent=%s/%s",
        user.id, request.app_id, request.agent_id,
    )

    return PushInstructionResponse(
        success=True,
        agent_name=updated_agent.get("displayName", request.agent_id),
        version_id=version_id,
        previous_instruction_preview=previous_instruction[:200],
        applied_instruction_preview=request.instruction[:200],
    )


@router.get("/agents/{project_id}/{app_id}")
async def list_agents_for_app(
    project_id: str,
    app_id: str,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> dict:
    """List all agents in a CES App — used to populate the agent selector."""
    user, access_token = auth
    ces = get_ces_service()
    agents = await ces.list_agents(
        project_id, get_settings().gcp_location, app_id, access_token,
    )
    return {"agents": agents}


@router.get("/tools/{project_id}/{app_id}")
async def list_tools_for_app(
    project_id: str,
    app_id: str,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> dict:
    """List all tools in a CES App — used to populate the tool reference selector."""
    user, access_token = auth
    ces = get_ces_service()
    tools = await ces.list_tools(
        project_id, get_settings().gcp_location, app_id, access_token,
    )
    return {"tools": tools}
