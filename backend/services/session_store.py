"""In-memory session store for transient accelerator state.

Keyed by sessionId (str). Two namespaces:

  _callbacks_store  — Acc-4 callback code
    values: [{ "agentId": str, "agentSlug": str, "callbacks": {hookType: code} }]

  _tools_store      — Acc-6 tool/toolset definitions
    values: { "tools": [ToolDefinition dicts], "toolsets": [ToolsetDefinition dicts] }

Both are intentionally simple (no TTL, no persistence) — they bridge
Acc-4/Acc-6 state with the Scaffolder ZIP build in the same server process.
"""

_callbacks_store: dict[str, list[dict]] = {}
_tools_store: dict[str, dict] = {}


# ── Callbacks (Acc-4) ─────────────────────────────────────────────────────────

def set_callbacks(session_id: str, agent_callbacks: list[dict]) -> None:
    _callbacks_store[session_id] = agent_callbacks


def get_callbacks(session_id: str) -> list[dict]:
    return _callbacks_store.get(session_id, [])


def clear_callbacks(session_id: str) -> None:
    _callbacks_store.pop(session_id, None)


# ── Tools (Acc-6) ─────────────────────────────────────────────────────────────

def set_tools(session_id: str, tools: list[dict], toolsets: list[dict]) -> None:
    _tools_store[session_id] = {"tools": tools, "toolsets": toolsets}


def get_tools(session_id: str) -> dict:
    """Return {"tools": [...], "toolsets": [...]} for the session, or empty lists."""
    return _tools_store.get(session_id, {"tools": [], "toolsets": []})


def clear_tools(session_id: str) -> None:
    _tools_store.pop(session_id, None)
