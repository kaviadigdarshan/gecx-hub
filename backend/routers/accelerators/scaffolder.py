"""Scaffolder accelerator router: suggest architecture, generate instructions, build AppSnapshot ZIP."""

import base64
import logging

from fastapi import APIRouter, Depends, HTTPException

from auth.dependencies import get_current_user_with_token
from models.auth import User
from models.accelerators.scaffolder import (
    AppScaffoldRequest,
    AppScaffoldResponse,
    ArchitectureSuggestRequest,
    ArchitectureSuggestion,
    ImportScaffoldRequest,
    ImportScaffoldResponse,
)
from services.architecture_service import generate_instruction_scaffolds, suggest_architecture
from services.ces_service import get_ces_service
from services.gcs_service import get_gcs_service
from services.scaffolder_service import build_scaffold_zip

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accelerators/scaffolder", tags=["Scaffolder"])


@router.post("/suggest-architecture", response_model=ArchitectureSuggestion)
async def suggest_agent_architecture(
    request: ArchitectureSuggestRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
):
    """
    Calls Gemini to suggest a multi-agent topology for the given use case.
    Fast endpoint — user calls this after Step 1.
    """
    return await suggest_architecture(request)


@router.post("/generate", response_model=AppScaffoldResponse)
async def generate_scaffold(
    request: AppScaffoldRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
):
    """
    Generates the complete AppSnapshot ZIP from the finalized architecture.
    Calls Gemini to scaffold each agent's instruction.
    Uploads to GCS and returns a signed download URL.
    """
    user, access_token = auth

    # Generate instruction scaffolds for all agents via Gemini
    instruction_scaffolds = await generate_instruction_scaffolds(
        request.architecture,
        request.use_case.model_dump(),
    )

    # Build the ZIP
    zip_bytes, response = await build_scaffold_zip(request, instruction_scaffolds)

    # Upload to GCS
    gcs = get_gcs_service()
    blob_name = f"scaffolds/{response.request_id}/{response.zip_filename}"
    download_url = await gcs.upload_and_get_url(zip_bytes, blob_name)

    # Fill in the download URL
    response.download_url = download_url

    return response


@router.post("/import", response_model=ImportScaffoldResponse)
async def import_scaffold_to_app(
    request: ImportScaffoldRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
):
    """
    Imports a generated scaffold ZIP directly into CX Agent Studio via importApp.
    The user provides the base64-encoded ZIP (from a previous /generate call).
    """
    user, access_token = auth
    ces = get_ces_service()

    try:
        zip_bytes = base64.b64decode(request.zip_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 ZIP data")

    result = await ces.import_app(
        request.project_id,
        request.location,
        zip_bytes,
        access_token,
    )

    if result.get("pending"):
        return ImportScaffoldResponse(
            success=True,
            app_name="(import in progress)",
            app_id="(pending)",
            app_console_url=result.get("console_url", ""),
        )

    app_name = result.get("name", "")
    app_id = app_name.split("/")[-1] if app_name else ""
    console_url = (
        f"https://ces.cloud.google.com/projects/{request.project_id}"
        f"/locations/{request.location}/apps/{app_id}"
    )

    return ImportScaffoldResponse(
        success=True,
        app_name=app_name,
        app_id=app_id,
        app_console_url=console_url,
    )
