"""Scaffolder accelerator router: suggest architecture, generate instructions, build AppSnapshot ZIP."""

import base64
import io
import json
import logging
import os
import uuid
import zipfile
from datetime import datetime, timezone

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
    MergedZipRequest,
    RegenerateScaffoldRequest,
    RegenerateScaffoldResponse,
    SuggestVariablesRequest,
    SuggestVariablesResponse,
)
from models.project_context import AgentContextEntry, ScaffoldContext, ToolContextEntry
from services.architecture_service import (
    generate_instruction_scaffolds,
    suggest_architecture,
    suggest_session_variables,
)
from services.ces_service import get_ces_service
from services.gcs_service import get_gcs_service
from services.scaffolder_service import build_scaffold_zip, patch_zip_guardrails
from services.session_store import clear_callbacks, get_callbacks

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


@router.post("/suggest-variables", response_model=SuggestVariablesResponse)
async def suggest_variables(
    request: SuggestVariablesRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> SuggestVariablesResponse:
    """Return Gemini-generated session variable suggestions for the given vertical."""
    suggestions = await suggest_session_variables(request.vertical, request.agents)
    return SuggestVariablesResponse(suggestions=suggestions)


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

    # Look up any Acc-4 callback data stored for this session
    agent_callbacks = get_callbacks(request.session_id) if request.session_id else []

    # Build the ZIP
    zip_bytes, response = await build_scaffold_zip(request, instruction_scaffolds, agent_callbacks or None)

    # Upload to GCS
    gcs = get_gcs_service()
    blob_name = f"scaffolds/{response.request_id}/{response.zip_filename}"
    download_url = await gcs.upload_and_get_url(zip_bytes, blob_name)

    # Fill in the download URL
    response.download_url = download_url

    # Release session callback data — no longer needed after ZIP is built
    if request.session_id:
        clear_callbacks(request.session_id)

    # Persist a ScaffoldContext to GCS keyed by scaffold_id (non-fatal)
    try:
        now = datetime.now(timezone.utc).isoformat()
        ctx = ScaffoldContext(
            scaffold_id=response.request_id,
            app_display_name=request.global_settings.app_display_name,
            business_domain=request.use_case.business_domain,
            channel=request.use_case.channel,
            company_name=request.use_case.company_name,
            expected_capabilities=request.use_case.expected_capabilities,
            agents=[
                AgentContextEntry(
                    slug=p.agent_slug,
                    name=p.display_name,
                    agent_type=p.agent_type,
                    role_summary=next(
                        (a.role_summary for a in request.architecture if a.slug == p.agent_slug), ""
                    ),
                    handles=next(
                        (a.handles for a in request.architecture if a.slug == p.agent_slug), []
                    ),
                    suggested_tools=next(
                        (a.suggested_tools for a in request.architecture if a.slug == p.agent_slug), []
                    ),
                    persona=next(
                        (a.persona for a in request.architecture if a.slug == p.agent_slug), ""
                    ),
                )
                for p in response.agent_previews
            ],
            tool_stubs=[
                ToolContextEntry(
                    tool_name=stub.tool_name,
                    display_name=stub.display_name,
                    base_url_env_var=stub.base_url_env_var,
                    auth_type=stub.auth_type,
                )
                for stub in request.tool_stubs
            ],
            environment_vars=response.environment_vars,
            guardrails_applied=False,
            guardrail_names=[],
            created_at=now,
            last_updated_at=now,
            generated_zip_filename=response.zip_filename,
        )
        ctx_blob = f"contexts/{response.request_id}/scaffold_context.json"
        await gcs.upload_bytes(
            ctx.model_dump_json(indent=2).encode("utf-8"),
            ctx_blob,
            content_type="application/json",
        )
        logger.info("ScaffoldContext saved: scaffold_id=%s", response.request_id)
    except Exception as exc:
        logger.warning("Could not save ScaffoldContext after scaffold generate: %s", exc)

    return response


@router.post("/regenerate", response_model=RegenerateScaffoldResponse)
async def regenerate_scaffold(
    request: RegenerateScaffoldRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> RegenerateScaffoldResponse:
    """Reload ScaffoldContext by scaffold_id, patch app.json guardrails, re-upload ZIP."""
    gcs = get_gcs_service()
    ctx_blob = f"contexts/{request.scaffold_context_id}/scaffold_context.json"
    try:
        raw = await gcs.download_bytes(ctx_blob)
        ctx = ScaffoldContext.model_validate_json(raw)
    except FileNotFoundError:
        raise HTTPException(404, "ScaffoldContext not found — generate a scaffold first")
    except Exception as exc:
        raise HTTPException(500, f"Failed to load ScaffoldContext: {exc}")

    if not ctx.generated_zip_filename:
        raise HTTPException(422, "ScaffoldContext has no generated_zip_filename")

    zip_blob = f"scaffolds/{ctx.scaffold_id}/{ctx.generated_zip_filename}"
    try:
        zip_bytes = await gcs.download_bytes(zip_blob)
    except FileNotFoundError:
        raise HTTPException(404, "Original scaffold ZIP not found in GCS")

    guardrail_names = ctx.guardrail_names or []
    patched_zip = await patch_zip_guardrails(zip_bytes, guardrail_names)
    download_url = await gcs.upload_and_get_url(patched_zip, zip_blob)

    # Update last_updated_at in the stored context
    try:
        ctx.last_updated_at = datetime.now(timezone.utc).isoformat()
        await gcs.upload_bytes(
            ctx.model_dump_json(indent=2).encode("utf-8"),
            ctx_blob,
            content_type="application/json",
        )
    except Exception as exc:
        logger.warning("Could not update ScaffoldContext timestamp after regenerate: %s", exc)

    logger.info(
        "Scaffold ZIP regenerated: scaffold_id=%s guardrails=%d",
        ctx.scaffold_id, len(guardrail_names),
    )
    return RegenerateScaffoldResponse(
        download_url=download_url,
        guardrail_count=len(guardrail_names),
    )


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


@router.post("/merge-zip")
async def merge_zip(request: MergedZipRequest):
    """Reads original scaffold ZIP, merges downstream accelerator output, returns new download URL."""
    original_dir = f"/tmp/gecx-hub-artifacts/{request.original_request_id}"
    if not os.path.exists(original_dir):
        raise HTTPException(status_code=404, detail="Original scaffold not found. Re-generate first.")

    zip_files = [f for f in os.listdir(original_dir) if f.endswith(".zip")]
    if not zip_files:
        raise HTTPException(status_code=404, detail="Original scaffold ZIP not found.")

    new_id = str(uuid.uuid4())
    new_dir = f"/tmp/gecx-hub-artifacts/{new_id}"
    os.makedirs(new_dir, exist_ok=True)

    buf = io.BytesIO()
    with zipfile.ZipFile(os.path.join(original_dir, zip_files[0]), "r") as orig:
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as out:
            for item in orig.infolist():
                out.writestr(item, orig.read(item.filename))
            if request.agent_instructions:
                out.writestr(
                    "instructions/agent_instructions.json",
                    json.dumps(request.agent_instructions, indent=2),
                )
            if request.guardrails_config:
                out.writestr(
                    "guardrails/guardrails_config.json",
                    json.dumps(request.guardrails_config, indent=2),
                )
            if request.tools_config:
                out.writestr(
                    "tools/tools_config.json",
                    json.dumps(request.tools_config, indent=2),
                )

    filename = f"gecx-hub-merged-{new_id[:8]}.zip"
    with open(os.path.join(new_dir, filename), "wb") as f:
        f.write(buf.getvalue())

    return {"request_id": new_id, "download_url": f"/downloads/{new_id}/{filename}"}
