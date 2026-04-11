"""Pydantic models for the Callback Accelerator (Acc-4)."""

from typing import Optional

from pydantic import BaseModel


_VALID_HOOK_TYPES = {"beforeAgent", "afterModel", "afterTool", "beforeModel", "afterAgent"}


class VariableDeclaration(BaseModel):
    name: str
    type: str = "STRING"


class CallbackGenerateRequest(BaseModel):
    agentId: str
    agentName: str
    agentDescription: str
    hookTypes: list[str]
    vertical: str
    variableDeclarations: list[VariableDeclaration] = []
    sessionId: Optional[str] = None

    @classmethod
    def model_validator(cls, values: dict) -> dict:  # type: ignore[override]
        return values


class CallbackGenerateResponse(BaseModel):
    callbacks: dict[str, str]
    demo_mode: bool = False


class CallbackWriteRequest(BaseModel):
    sessionId: str
    agentCallbacks: list[dict]  # [{ agentId, agentSlug, callbacks: {hookType: code} }]


class CallbackWriteResponse(BaseModel):
    stored: bool
    session_id: str
    agent_count: int
