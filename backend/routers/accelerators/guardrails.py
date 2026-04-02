"""Guardrails accelerator router: generate, preview, and apply guardrail configs."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user_with_token
from models.auth import User
from models.accelerators.guardrails import (
    GuardrailApplyResult,
    GuardrailsApplyRequest,
    GuardrailsApplyResponse,
    GuardrailsGenerateRequest,
    GuardrailsGenerateResponse,
)
from models.project_context import ScaffoldContext
from services.ces_service import get_ces_service
from services.gcs_service import get_gcs_service
from services.guardrails_service import (
    build_guardrail_configs_map,
    build_guardrails_pack,
    generate_guardrail_names,
    guardrail_to_preview,
    load_preset,
    package_guardrails_zip,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accelerators/guardrails", tags=["Guardrails"])


@router.post("/generate", response_model=GuardrailsGenerateResponse)
async def generate_guardrails(
    request: GuardrailsGenerateRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> GuardrailsGenerateResponse:
    """Build a guardrails pack from the industry preset, upload to GCS, return previews + signed URL."""
    user, access_token = auth
    request_id = str(uuid.uuid4())
    logger.info(
        "Generating guardrails: user=%s vertical=%s sensitivity=%s request_id=%s",
        user.id, request.industry_vertical, request.sensitivity_level, request_id,
    )

    preset = load_preset(request.industry_vertical)
    guardrails = await build_guardrails_pack(request, preset)
    previews = [guardrail_to_preview(g) for g in guardrails]

    # 22-name taxonomy — Gemini-powered with demo fallback
    clusters = await generate_guardrail_names(request.industry_vertical)
    guardrail_names = [name for names in clusters.values() for name in names]
    guardrail_configs = build_guardrail_configs_map(clusters, request, preset)
    configs_by_cluster = {cluster: list(names) for cluster, names in clusters.items()}

    zip_bytes = await package_guardrails_zip(guardrails, request.industry_vertical)
    zip_filename = f"guardrails_{request.industry_vertical}_{request_id[:8]}.zip"
    blob_name = f"guardrails/{request_id}/{zip_filename}"

    gcs = get_gcs_service()
    download_url = await gcs.upload_and_get_url(zip_bytes, blob_name)
    logger.info("Guardrails ZIP uploaded: blob=%s", blob_name)

    # Write guardrail names back to ScaffoldContext in GCS (non-fatal)
    updated_context: ScaffoldContext | None = None
    if request.project_id:
        ctx_blob = f"contexts/{request.project_id}/scaffold_context.json"
        try:
            raw = await gcs.download_bytes(ctx_blob)
            ctx = ScaffoldContext.model_validate_json(raw)
            ctx.guardrail_names = guardrail_names
            ctx.guardrails_applied = True
            ctx.guardrails_industry = request.industry_vertical
            ctx.last_updated_at = datetime.now(timezone.utc).isoformat()
            await gcs.upload_bytes(
                ctx.model_dump_json(indent=2).encode("utf-8"),
                ctx_blob,
                content_type="application/json",
            )
            updated_context = ctx
            logger.info(
                "ScaffoldContext updated with %d guardrail names: project=%s",
                len(guardrail_names), request.project_id,
            )
        except Exception as exc:
            logger.warning(
                "Could not update ScaffoldContext for project %s: %s",
                request.project_id, exc,
            )

    return GuardrailsGenerateResponse(
        request_id=request_id,
        previews=previews,
        download_url=download_url,
        zip_filename=zip_filename,
        apply_ready=True,
        industry_preset_used=request.industry_vertical,
        generation_timestamp=datetime.now(timezone.utc).isoformat(),
        guardrail_names=guardrail_names,
        guardrail_configs=guardrail_configs,
        configs_by_cluster=configs_by_cluster,
        updated_scaffold_context=updated_context,
    )


@router.post("/apply", response_model=GuardrailsApplyResponse, status_code=200)
async def apply_guardrails(
    request: GuardrailsApplyRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> GuardrailsApplyResponse:
    """Apply a list of guardrail resources to a CES app, preceded by a version snapshot."""
    user, access_token = auth
    ces = get_ces_service()
    results: list[GuardrailApplyResult] = []
    version_id: str | None = None

    logger.info(
        "Applying %d guardrails: user=%s project=%s app=%s",
        len(request.guardrails), user.id, request.project_id, request.app_id,
    )

    # Create a version snapshot before writing — non-fatal if it fails
    try:
        snapshot_name = (
            f"pre-guardrail-import-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        )
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

    # Apply each guardrail individually, collecting per-item results
    _GUARDRAIL_KEYS = ["contentFilter", "llmPromptSecurity", "llmPolicy", "modelSafety"]

    for guardrail in request.guardrails:
        guardrail_type = next(
            (k for k in _GUARDRAIL_KEYS if k in guardrail), "unknown"
        )
        try:
            created = await ces.create_guardrail(
                request.project_id, request.location, request.app_id,
                guardrail, access_token,
            )
            results.append(
                GuardrailApplyResult(
                    guardrail_type=guardrail_type,
                    status="success",
                    resource_name=created.get("name"),
                )
            )
            logger.debug("Applied guardrail type=%s", guardrail_type)
        except Exception as exc:
            logger.warning("Failed to apply guardrail type=%s: %s", guardrail_type, exc)
            results.append(
                GuardrailApplyResult(
                    guardrail_type=guardrail_type,
                    status="failed",
                    error=str(exc),
                )
            )

    applied = sum(1 for r in results if r.status == "success")
    failed = sum(1 for r in results if r.status == "failed")
    logger.info("Apply complete: %d succeeded, %d failed", applied, failed)

    return GuardrailsApplyResponse(
        applied_count=applied,
        failed_count=failed,
        version_id=version_id,
        results=results,
    )
