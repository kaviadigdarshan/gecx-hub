"""Scaffold builder: assembles the AppSnapshot ZIP for the Multi-Agent App Scaffolder.

All implementation lives in services.artifact_builder. This module re-exports
every public name so existing imports from scaffolder_service continue to work.
"""

from services.artifact_builder import (
    TEMPLATES_DIR,
    _HOOK_DIR,
    _AGENT_JSON_KEY,
    _CALLBACK_STUBS,
    _active_hooks,
    build_environment_json,
    build_ces_environment_json,
    build_app_json,
    build_agent_json,
    build_tool_stub_json,
    build_ascii_diagram,
    build_readme,
    patch_zip_guardrails,
    build_scaffold_zip,
    build_app_snapshot_zip,
)

__all__ = [
    "TEMPLATES_DIR",
    "_HOOK_DIR",
    "_AGENT_JSON_KEY",
    "_CALLBACK_STUBS",
    "_active_hooks",
    "build_environment_json",
    "build_ces_environment_json",
    "build_app_json",
    "build_agent_json",
    "build_tool_stub_json",
    "build_ascii_diagram",
    "build_readme",
    "patch_zip_guardrails",
    "build_scaffold_zip",
    "build_app_snapshot_zip",
]
