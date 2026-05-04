from pydantic import BaseModel
from typing import List


class ExtractedField(BaseModel):
    field_name: str
    value: str
    confidence: str  # "high" | "medium" | "low"
    source_snippet: str


class SourceExtractionResult(BaseModel):
    fields: List[ExtractedField]
    raw_text_length: int
    target_accelerator: str
