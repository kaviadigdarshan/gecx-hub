"""Source extraction router: parse business documents into CES scaffold config."""

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user
from models.auth import User
from models.source_extraction import SourceExtractionRequest, SourceExtractionResponse
from services.source_extraction_service import extract_context

router = APIRouter(prefix="/context", tags=["Source Extraction"])


@router.post("/extract-from-source", response_model=SourceExtractionResponse)
async def extract_context_from_source(
    request: SourceExtractionRequest,
    current_user: User = Depends(get_current_user),
) -> SourceExtractionResponse:
    return await extract_context(request)
