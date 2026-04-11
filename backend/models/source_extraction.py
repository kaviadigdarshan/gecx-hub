from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class SourceInputType(str, Enum):
    FILE_UPLOAD = "file_upload"
    CLIPBOARD_TEXT = "clipboard_text"


class ExtractedSubAgent(BaseModel):
    name: str
    purpose: str
    tools_needed: List[str] = Field(default_factory=list)


class ExtractedSessionVariable(BaseModel):
    name: str  # UPPER_SNAKE_CASE convention
    description: str


class ExtractedTool(BaseModel):
    name: str
    description: str
    api_type: str = "rest"  # "rest" | "graphql" | "grpc"


class SourceExtractionRequest(BaseModel):
    input_type: SourceInputType
    text_content: Optional[str] = None   # used when input_type=clipboard_text
    filename: Optional[str] = None        # used when input_type=file_upload
    file_content_base64: Optional[str] = None  # base64-encoded file bytes


class SourceExtractionSuccess(BaseModel):
    primary_use_case: str
    industry_vertical: str
    root_agent_name: str
    root_agent_purpose: str
    sub_agents: List[ExtractedSubAgent] = Field(default_factory=list)
    persona_tone: Optional[str] = None
    in_scope: List[str] = Field(default_factory=list)
    out_of_scope: List[str] = Field(default_factory=list)
    session_variables: List[ExtractedSessionVariable] = Field(default_factory=list)
    tools_required: List[ExtractedTool] = Field(default_factory=list)
    guardrail_topics: List[str] = Field(default_factory=list)
    blocked_phrases: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    extraction_confidence: str = "high"  # "high" | "medium"


class SourceExtractionError(BaseModel):
    error: bool = True
    missing_required: List[str]
    message: str


class SourceExtractionResponse(BaseModel):
    success: bool
    data: Optional[SourceExtractionSuccess] = None
    error: Optional[SourceExtractionError] = None
