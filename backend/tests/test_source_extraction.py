"""Tests for POST /context/extract-from-source."""

import base64
from unittest.mock import patch

import pytest

from auth.dependencies import get_current_user
from main import app
from models.auth import User

_MOCK_USER = User(id="se-test-001", email="test@gecx.io", name="SE Test")


async def _override_auth() -> User:
    return _MOCK_USER


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = _override_auth
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_extract_clipboard_demo_mode(test_client, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "demo")
    response = test_client.post(
        "/context/extract-from-source",
        json={
            "input_type": "clipboard_text",
            "text_content": "Retail SoW for order management",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["industry_vertical"] == "retail"


def test_extract_empty_text_returns_400(test_client, monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    response = test_client.post(
        "/context/extract-from-source",
        json={
            "input_type": "clipboard_text",
            "text_content": "",
        },
    )
    assert response.status_code == 400


def test_extract_file_upload_txt_demo_mode(test_client, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "demo")
    encoded = base64.b64encode(b"Retail returns SoW").decode()
    response = test_client.post(
        "/context/extract-from-source",
        json={
            "input_type": "file_upload",
            "filename": "brief.txt",
            "file_content_base64": encoded,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
