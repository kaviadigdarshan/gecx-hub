"""Shared pytest fixtures: test client, mock settings, fake auth tokens."""

import os

# ── Set test env vars BEFORE importing the app ────────────────────────────────
# main.py calls get_settings() at module level; env vars must exist by then.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-gecx-hub-testing-only")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/callback")
os.environ.setdefault("GCP_PROJECT_ID", "test-project-id")
os.environ.setdefault("GCS_BUCKET_NAME", "test-bucket-gecx")

# Clear the lru_cache so settings re-reads the env vars we just set
from config import get_settings  # noqa: E402
get_settings.cache_clear()

# ── App & test client imports ─────────────────────────────────────────────────
import pytest  # noqa: E402
from unittest.mock import AsyncMock, MagicMock, patch  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402

from main import app  # noqa: E402
from auth.jwt_handler import create_session_token  # noqa: E402
from models.auth import User  # noqa: E402
from models.accelerators.guardrails import (  # noqa: E402
    GuardrailsGenerateRequest,
    GuardrailActionConfig,
    TriggerAction,
)
from services.guardrails_service import load_preset  # noqa: E402


# ── Core fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def test_client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest.fixture(scope="session")
def mock_user():
    return User(
        id="test-user-001",
        email="darshan@niveus.io",
        name="Darshan Test",
        picture=None,
    )


@pytest.fixture(scope="session")
def auth_token(mock_user):
    return create_session_token(
        mock_user.id, mock_user.email, "fake-gcp-access-token"
    )


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ── Preset fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def retail_preset():
    return load_preset("retail")


@pytest.fixture
def bfsi_preset():
    return load_preset("bfsi")


# ── Guardrails model fixtures ─────────────────────────────────────────────────

@pytest.fixture
def sample_action():
    return GuardrailActionConfig(
        action_type=TriggerAction.RESPOND_IMMEDIATELY,
        canned_response="I cannot assist with that request.",
    )


@pytest.fixture
def sample_request(sample_action):
    return GuardrailsGenerateRequest(
        industry_vertical="retail",
        agent_persona_type="customer_service",
        sensitivity_level="balanced",
        competitor_names=["BrandX", "BrandY"],
        custom_blocked_phrases=["hate speech"],
        custom_policy_rules="",
        enable_prompt_injection_guard=True,
        default_action=sample_action,
    )


# ── External-service mocks ────────────────────────────────────────────────────

@pytest.fixture
def mock_gcs():
    with patch("routers.accelerators.guardrails.get_gcs_service") as mock:
        service = MagicMock()
        service.upload_and_get_url = AsyncMock(
            return_value="https://storage.googleapis.com/test/signed-url"
        )
        mock.return_value = service
        yield service


@pytest.fixture
def mock_ces():
    with patch("routers.accelerators.guardrails.get_ces_service") as mock:
        service = MagicMock()
        service.create_version = AsyncMock(
            return_value={
                "name": "projects/p/locations/l/apps/a/versions/v1"
            }
        )
        service.create_guardrail = AsyncMock(
            return_value={
                "name": "projects/p/locations/l/apps/a/guardrails/g1"
            }
        )
        mock.return_value = service
        yield service


# ── Instruction Architect fixtures ────────────────────────────────────────────

@pytest.fixture
def sample_identity():
    from models.accelerators.instructions import AgentIdentityInput
    return AgentIdentityInput(
        agent_name="Order Support Agent",
        agent_purpose="Handle product returns, exchanges, and refund queries for retail customers",
        agent_type="sub_agent",
        parent_agent_context="The parent agent handles general customer inquiries",
    )


@pytest.fixture
def sample_persona():
    from models.accelerators.instructions import PersonaInput
    return PersonaInput(
        persona_name="Aria",
        tone="friendly_professional",
        brand_voice_keywords=["warm", "clear", "helpful"],
        language="en-US",
        company_name="Bluebell Retail",
    )


@pytest.fixture
def sample_scope():
    from models.accelerators.instructions import ScopeInput
    return ScopeInput(
        primary_goals=["Help customers initiate returns", "Explain refund timelines"],
        out_of_scope_topics=["Product recommendations", "Loyalty points"],
        escalation_triggers=["Customer expresses anger", "Policy exception needed"],
        escalation_target="human customer service agent",
    )


@pytest.fixture
def sample_tools_input():
    from models.accelerators.instructions import ToolsInput, ToolReferenceInput
    return ToolsInput(tools=[
        ToolReferenceInput(
            tool_name="returns_api",
            tool_description="Initiates a product return request",
            when_to_use="When customer wants to return a product",
        )
    ])


@pytest.fixture
def sample_error_handling():
    from models.accelerators.instructions import ErrorHandlingInput
    return ErrorHandlingInput(
        no_answer_response="I'm sorry, I couldn't find that information.",
        tool_failure_response="I'm having trouble accessing that right now.",
        max_clarification_attempts=2,
        fallback_behavior="apologize_and_escalate",
    )


# ── Multi-Agent App Scaffolder fixtures ───────────────────────────────────────

@pytest.fixture
def sample_use_case():
    from models.accelerators.scaffolder import UseCaseInput
    return UseCaseInput(
        business_domain="retail",
        primary_use_case="Handle product returns, order status queries, and loyalty points redemption for a luxury retail brand",
        channel="web_chat",
        company_name="Bluebell Retail",
        expected_capabilities=["returns_refunds", "order_management", "loyalty_rewards", "escalation_to_human"]
    )


@pytest.fixture
def sample_agents():
    from models.accelerators.scaffolder import AgentDefinition
    return [
        AgentDefinition(
            name="Root Agent",
            slug="root_agent",
            agent_type="root_agent",
            role_summary="Routes customer queries to the appropriate specialist agent",
            handles=["escalation_to_human"],
            suggested_tools=[],
            ai_generated=True,
        ),
        AgentDefinition(
            name="Order Support Agent",
            slug="order_support_agent",
            agent_type="sub_agent",
            role_summary="Handles all order-related queries including returns and tracking",
            handles=["returns_refunds", "order_management"],
            suggested_tools=["order_api", "returns_api"],
            ai_generated=True,
        ),
        AgentDefinition(
            name="Loyalty Agent",
            slug="loyalty_agent",
            agent_type="sub_agent",
            role_summary="Manages loyalty points and rewards redemption",
            handles=["loyalty_rewards"],
            suggested_tools=["loyalty_api"],
            ai_generated=True,
        ),
    ]


@pytest.fixture
def sample_global_settings():
    from models.accelerators.scaffolder import GlobalSettings
    return GlobalSettings(
        app_display_name="Bluebell Retail CX App",
        default_language="en-US",
        logging_enabled=True,
        execution_mode="sequential",
        global_instruction_keywords="professional, warm, helpful",
    )


@pytest.fixture
def sample_tool_stubs():
    from models.accelerators.scaffolder import ToolStubConfig
    return [
        ToolStubConfig(
            tool_name="order_api",
            display_name="Order Management API",
            description="Retrieves and manages customer orders",
            base_url_env_var="ORDER_API_BASE_URL",
            auth_type="api_key",
            assigned_to_agents=["order_support_agent"],
        )
    ]


@pytest.fixture
def sample_scaffold_request(sample_use_case, sample_agents, sample_global_settings, sample_tool_stubs):
    from models.accelerators.scaffolder import AppScaffoldRequest
    return AppScaffoldRequest(
        use_case=sample_use_case,
        architecture=sample_agents,
        tool_stubs=sample_tool_stubs,
        global_settings=sample_global_settings,
        include_guardrails_placeholder=True,
        include_examples_placeholder=True,
    )


@pytest.fixture
def mock_architecture_gemini():
    with patch("services.architecture_service.get_gemini_service") as mock:
        service = MagicMock()
        service.generate_structured_json = AsyncMock(return_value={
            "agents": [
                {"name": "Root Agent", "slug": "root_agent", "agent_type": "root_agent",
                 "role_summary": "Routes queries", "handles": ["escalation_to_human"],
                 "suggested_tools": [], "ai_generated": True},
                {"name": "Order Agent", "slug": "order_agent", "agent_type": "sub_agent",
                 "role_summary": "Handles orders", "handles": ["order_management"],
                 "suggested_tools": ["order_api"], "ai_generated": True},
            ],
            "rationale": "Separated order management for clarity",
            "decomposition_strategy": "capability_based",
            "root_agent_style": "pure_router",
            "estimated_complexity": "simple",
        })
        service.generate_with_retry = AsyncMock(return_value="<role>\nScaffold instruction\n</role>")
        mock.return_value = service
        yield service


# ── Test infrastructure fixtures ──────────────────────────────────────────────

@pytest.fixture(autouse=True)
def use_local_storage(monkeypatch):
    """Force local artifact storage for all tests (no GCS calls)."""
    monkeypatch.setenv("USE_LOCAL_STORAGE", "true")
    monkeypatch.setenv("LOCAL_ARTIFACT_DIR", "/tmp/gecx-test-artifacts")


@pytest.fixture(autouse=True)
def clean_artifact_dir():
    """Wipe and recreate the local artifact dir before each test."""
    import shutil
    import os
    path = "/tmp/gecx-test-artifacts"
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(path, exist_ok=True)
    yield
    if os.path.exists(path):
        shutil.rmtree(path)


@pytest.fixture
def respx_mock():
    """respx mock context for intercepting outbound HTTP requests."""
    import respx
    with respx.mock(assert_all_called=False) as mock:
        yield mock
