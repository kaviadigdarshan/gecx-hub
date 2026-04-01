"""Unit tests for services/gemini_service.py.

All outbound Gemini API calls are intercepted via unittest.mock.patch.
The real API is never called.

The service uses google.genai.Client (AI Studio path) when GEMINI_API_KEY is
set, or vertexai (Vertex AI path) otherwise.  All tests force the AI Studio
path via monkeypatch so no GCP credentials are required.
"""

import asyncio
import pytest
from unittest.mock import MagicMock, patch, AsyncMock


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_mock_client(response_text: str) -> MagicMock:
    """Build a mock genai.Client whose models.generate_content returns response_text."""
    mock_response = MagicMock()
    mock_response.text = response_text

    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response

    mock_client = MagicMock()
    mock_client.models = mock_models
    return mock_client


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_gemini_cache():
    """Reset the lru_cache before and after each test."""
    from services.gemini_service import get_gemini_service
    get_gemini_service.cache_clear()
    yield
    get_gemini_service.cache_clear()


@pytest.fixture
def api_key_env(monkeypatch):
    """Force the AI Studio backend by injecting a fake API key."""
    monkeypatch.setenv("GEMINI_API_KEY", "test-api-key-does-not-call-real-api")


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestGeminiService:

    async def test_generate_text_returns_string(self, api_key_env):
        mock_client = _make_mock_client("Generated text response")

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            result = await service.generate_text("Test prompt")

        assert isinstance(result, str)
        assert len(result) > 0

    async def test_generate_text_calls_gemini_api(self, api_key_env):
        mock_client = _make_mock_client("hello world")

        with patch("google.genai.Client", return_value=mock_client) as mock_cls:
            from services.gemini_service import GeminiService
            service = GeminiService()
            await service.generate_text("ping")

        # Client was instantiated with the injected key
        mock_cls.assert_called_once_with(api_key="test-api-key-does-not-call-real-api")
        # generate_content was called on the models attribute
        mock_client.models.generate_content.assert_called_once()

    async def test_generate_structured_json_returns_dict(self, api_key_env):
        mock_client = _make_mock_client('{"agents": [], "rationale": "mock response"}')

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            result = await service.generate_structured_json("Return a JSON object")

        assert isinstance(result, dict)
        assert "rationale" in result

    async def test_generate_structured_json_strips_markdown_fences(self, api_key_env):
        mock_client = _make_mock_client('```json\n{"key": "value"}\n```')

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            result = await service.generate_structured_json("Return JSON")

        assert result == {"key": "value"}

    async def test_generate_structured_json_handles_preamble(self, api_key_env):
        """Gemini sometimes prefixes JSON with prose — must still parse."""
        raw = 'Here is the architecture:\n```json\n{"agents": [{"name": "Root"}]}\n```'
        mock_client = _make_mock_client(raw)

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            result = await service.generate_structured_json("Suggest architecture")

        assert result["agents"][0]["name"] == "Root"

    async def test_generate_structured_json_raises_422_on_unparseable(self, api_key_env):
        """Completely unparseable response triggers HTTPException 422."""
        from fastapi import HTTPException
        mock_client = _make_mock_client("This is definitely not JSON in any form at all.")

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            with pytest.raises(HTTPException) as exc_info:
                await service.generate_structured_json("Return JSON")

        assert exc_info.value.status_code == 422

    async def test_generate_text_wraps_api_error_as_502(self, api_key_env):
        """Any exception from the Gemini API becomes HTTPException 502."""
        from fastapi import HTTPException

        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = RuntimeError("Network error")

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            with pytest.raises(HTTPException) as exc_info:
                await service.generate_text("Any prompt")

        assert exc_info.value.status_code == 502

    async def test_generate_structured_json_appends_json_instruction(self, api_key_env):
        """The JSON-only instruction must be appended to the user's prompt."""
        mock_client = _make_mock_client('{"result": true}')

        with patch("google.genai.Client", return_value=mock_client):
            from services.gemini_service import GeminiService
            service = GeminiService()
            await service.generate_structured_json("Original prompt")

        call_kwargs = mock_client.models.generate_content.call_args
        contents_arg = call_kwargs.kwargs.get("contents") or call_kwargs.args[1]
        assert "Original prompt" in contents_arg
        assert "JSON" in contents_arg

    def test_gemini_service_is_singleton_via_lru_cache(self, api_key_env):
        """get_gemini_service() returns the same instance on repeated calls."""
        with patch("google.genai.Client"):
            from services.gemini_service import get_gemini_service
            s1 = get_gemini_service()
            s2 = get_gemini_service()
            assert s1 is s2

    def test_gemini_service_backend_is_ai_studio_when_key_set(self, api_key_env):
        """With GEMINI_API_KEY set the backend attribute must be 'ai_studio'."""
        with patch("google.genai.Client"):
            from services.gemini_service import GeminiService
            service = GeminiService()
            assert service._backend == "ai_studio"

    def test_gemini_service_stores_model_name(self, api_key_env):
        """Model name is read from settings and stored on the service instance."""
        with patch("google.genai.Client"):
            from services.gemini_service import GeminiService
            service = GeminiService()
            assert "gemini" in service.model_name.lower()
