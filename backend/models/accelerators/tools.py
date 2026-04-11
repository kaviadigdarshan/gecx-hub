"""Pydantic models for the Tools Configurator (Acc-6)."""

from typing import Literal, Optional

from pydantic import BaseModel


class DatastoreSource(BaseModel):
    dataStoreName: str


class ToolDefinition(BaseModel):
    id: str
    type: Literal["DATASTORE", "OPENAPI"]
    datastoreSource: Optional[DatastoreSource] = None
    openApiUrl: Optional[str] = None


class ToolsetDefinition(BaseModel):
    id: str
    openApiUrl: str
    toolIds: list[str]


class ToolsSaveRequest(BaseModel):
    tools: list[ToolDefinition]
    toolsets: list[ToolsetDefinition]
    sessionId: Optional[str] = None


class ToolsSaveResponse(BaseModel):
    tools: list[ToolDefinition]
    toolsets: list[ToolsetDefinition]


class ToolsTemplatesResponse(BaseModel):
    templates: dict[str, list[ToolDefinition]]
