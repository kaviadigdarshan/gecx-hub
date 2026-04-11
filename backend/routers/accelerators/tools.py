"""Tools Configurator router (Acc-6): save tool/toolset definitions and serve starter templates."""

import logging

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user_with_token
from models.auth import User
from models.accelerators.tools import (
    ToolDefinition,
    ToolsSaveRequest,
    ToolsSaveResponse,
    ToolsTemplatesResponse,
)
from services.session_store import set_tools

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accelerators/tools", tags=["Tools"])

_TEMPLATES: dict[str, list[ToolDefinition]] = {
    "retail": [
        ToolDefinition(
            id="FAQ_BQ_Datastore_v3",
            type="DATASTORE",
            datastoreSource={
                "dataStoreName": (
                    "projects/{project}/locations/global/collections/"
                    "default_collection/dataStores/faq-store"
                )
            },
        ),
        ToolDefinition(
            id="order_management",
            type="OPENAPI",
            openApiUrl="https://api.example.com/orders/openapi.json",
        ),
    ],
    "generic": [],
}


@router.post("/save", response_model=ToolsSaveResponse)
async def save_tools(
    request: ToolsSaveRequest,
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> ToolsSaveResponse:
    """Persist tool and toolset definitions to session state and return the merged fragment."""
    user, _ = auth
    logger.info(
        "Tools save: user=%s tools=%d toolsets=%d session=%s",
        user.id,
        len(request.tools),
        len(request.toolsets),
        request.sessionId,
    )

    if request.sessionId:
        set_tools(
            request.sessionId,
            [t.model_dump() for t in request.tools],
            [ts.model_dump() for ts in request.toolsets],
        )

    return ToolsSaveResponse(tools=request.tools, toolsets=request.toolsets)


@router.get("/templates", response_model=ToolsTemplatesResponse)
async def get_templates(
    auth: tuple[User, str] = Depends(get_current_user_with_token),
) -> ToolsTemplatesResponse:
    """Return starter tool templates keyed by industry vertical."""
    return ToolsTemplatesResponse(templates=_TEMPLATES)
