"""Tests for the Callbacks accelerator router.

Endpoints under test:
  POST /api/accelerators/callbacks/write-to-scaffold
"""

import pytest
from unittest.mock import patch


class TestWriteToScaffold:

    def test_requires_auth(self, test_client):
        response = test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            json={"sessionId": "s1", "agentCallbacks": []},
        )
        assert response.status_code in (401, 403)

    def test_stores_callbacks_and_returns_count(self, test_client, auth_headers):
        payload = {
            "sessionId": "test-session-001",
            "agentCallbacks": [
                {
                    "agentId": "root-001",
                    "agentSlug": "root_agent",
                    "callbacks": {"beforeAgent": "def before_agent_callback(ctx): pass"},
                }
            ],
        }
        response = test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["stored"] is True
        assert body["session_id"] == "test-session-001"
        assert body["agent_count"] == 1

    def test_empty_agent_callbacks_accepted(self, test_client, auth_headers):
        payload = {"sessionId": "empty-session", "agentCallbacks": []}
        response = test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["agent_count"] == 0

    def test_multiple_agents_counted_correctly(self, test_client, auth_headers):
        payload = {
            "sessionId": "multi-session",
            "agentCallbacks": [
                {"agentId": "a1", "agentSlug": "root_agent",  "callbacks": {"beforeAgent": "# code"}},
                {"agentId": "a2", "agentSlug": "order_agent", "callbacks": {"afterTool": "# code"}},
            ],
        }
        response = test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["agent_count"] == 2

    def test_data_is_readable_from_session_store(self, test_client, auth_headers):
        from services.session_store import get_callbacks
        session_id = "readable-session-xyz"
        callbacks = [{"agentId": "x1", "agentSlug": "my_agent", "callbacks": {"beforeAgent": "# g"}}]
        test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            headers=auth_headers,
            json={"sessionId": session_id, "agentCallbacks": callbacks},
        )
        stored = get_callbacks(session_id)
        assert len(stored) == 1
        assert stored[0]["agentSlug"] == "my_agent"

    def test_overwrite_existing_session(self, test_client, auth_headers):
        from services.session_store import get_callbacks
        session_id = "overwrite-session"
        # First write
        test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            headers=auth_headers,
            json={"sessionId": session_id, "agentCallbacks": [
                {"agentId": "a1", "agentSlug": "agent_one", "callbacks": {"beforeAgent": "# v1"}}
            ]},
        )
        # Second write with different data
        test_client.post(
            "/api/accelerators/callbacks/write-to-scaffold",
            headers=auth_headers,
            json={"sessionId": session_id, "agentCallbacks": [
                {"agentId": "a2", "agentSlug": "agent_two", "callbacks": {"afterTool": "# v2"}}
            ]},
        )
        stored = get_callbacks(session_id)
        assert len(stored) == 1
        assert stored[0]["agentSlug"] == "agent_two"
