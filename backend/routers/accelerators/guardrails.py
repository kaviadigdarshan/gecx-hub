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
from services.ces_service import get_ces_service
from services.gcs_service import get_gcs_service
from services.guardrails_service import (
    build_guardrails_pack,
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

    zip_bytes = await package_guardrails_zip(guardrails, request.industry_vertical)
    zip_filename = f"guardrails_{request.industry_vertical}_{request_id[:8]}.zip"
    blob_name = f"guardrails/{request_id}/{zip_filename}"

    gcs = get_gcs_service()
    download_url = await gcs.upload_and_get_url(zip_bytes, blob_name)
    logger.info("Guardrails ZIP uploaded: blob=%s", blob_name)

    return GuardrailsGenerateResponse(
        request_id=request_id,
        previews=previews,
        download_url=download_url,
        zip_filename=zip_filename,
        apply_ready=True,
        industry_preset_used=request.industry_vertical,
        generation_timestamp=datetime.now(timezone.utc).isoformat(),
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
