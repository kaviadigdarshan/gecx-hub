"""Tests for the /downloads/{request_id}/{filename} FileResponse endpoint.

The endpoint serves files from LOCAL_ARTIFACTS_DIR (default: /tmp/gecx-hub-artifacts).
Tests patch that module-level variable to use /tmp/gecx-test-artifacts so they
stay within the directory managed by the clean_artifact_dir conftest fixture.

Note: the /downloads endpoint is intentionally public (no auth required).
Request IDs act as unguessable bearer tokens for artifact access.
"""

import os
import pytest
from pathlib import Path
from unittest.mock import patch

# Redirect the endpoint to the test artifact directory
TEST_ARTIFACTS = Path("/tmp/gecx-test-artifacts")


@pytest.fixture(autouse=True)
def patch_artifacts_dir():
    """Point the downloads router at the test artifact directory."""
    with patch("routers.downloads.LOCAL_ARTIFACTS_DIR", TEST_ARTIFACTS):
        yield


class TestDownloadsEndpoint:

    def test_download_existing_file_returns_200(self, test_client):
        req_dir = TEST_ARTIFACTS / "req_001"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "guardrails.zip").write_bytes(b"PK\x03\x04 fake zip content")

        response = test_client.get("/downloads/req_001/guardrails.zip")
        assert response.status_code == 200

    def test_download_nonexistent_file_returns_404(self, test_client):
        response = test_client.get("/downloads/req_does_not_exist/missing.zip")
        assert response.status_code == 404

    def test_download_is_publicly_accessible_without_auth(self, test_client):
        """The endpoint serves artifacts via unguessable request_id — no auth token needed."""
        req_dir = TEST_ARTIFACTS / "req_public"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "output.zip").write_bytes(b"PK\x03\x04 public zip")

        # Call WITHOUT Authorization header
        response = test_client.get("/downloads/req_public/output.zip")
        assert response.status_code == 200

    def test_download_missing_file_no_auth_returns_404_not_401(self, test_client):
        """Missing file on public endpoint returns 404, not 401."""
        response = test_client.get("/downloads/ghost_req/ghost.zip")
        assert response.status_code == 404

    def test_download_path_traversal_does_not_return_200(self, test_client):
        """Path traversal attempts must never serve a file (404, 422, or redirect)."""
        response = test_client.get("/downloads/../../../etc/passwd")
        assert response.status_code != 200

    def test_download_path_traversal_dot_dot_in_request_id(self, test_client):
        """Dotdot in request_id component must not escape the artifact directory."""
        response = test_client.get("/downloads/..%2F..%2Fetc/passwd")
        assert response.status_code != 200

    def test_download_content_type_is_zip(self, test_client):
        req_dir = TEST_ARTIFACTS / "req_002"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "output.zip").write_bytes(b"PK\x03\x04 fake zip")

        response = test_client.get("/downloads/req_002/output.zip")
        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "zip" in content_type.lower() or "octet" in content_type.lower()

    def test_download_content_disposition_header_present(self, test_client):
        req_dir = TEST_ARTIFACTS / "req_003"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "scaffold.zip").write_bytes(b"PK\x03\x04 scaffold zip")

        response = test_client.get("/downloads/req_003/scaffold.zip")
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "scaffold.zip" in disposition

    def test_download_returns_correct_bytes(self, test_client):
        payload = b"PK\x03\x04" + b"\x00" * 26 + b"fake content"
        req_dir = TEST_ARTIFACTS / "req_004"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "exact.zip").write_bytes(payload)

        response = test_client.get("/downloads/req_004/exact.zip")
        assert response.status_code == 200
        assert response.content == payload

    def test_download_404_detail_message(self, test_client):
        response = test_client.get("/downloads/no_such_req/no_such_file.zip")
        assert response.status_code == 404
        body = response.json()
        assert "detail" in body

    def test_multiple_files_in_same_request_dir(self, test_client):
        req_dir = TEST_ARTIFACTS / "req_multi"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "guardrails.zip").write_bytes(b"PK guardrails")
        (req_dir / "scaffold.zip").write_bytes(b"PK scaffold")

        r1 = test_client.get("/downloads/req_multi/guardrails.zip")
        r2 = test_client.get("/downloads/req_multi/scaffold.zip")
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.content != r2.content

    def test_empty_file_is_served(self, test_client):
        req_dir = TEST_ARTIFACTS / "req_empty"
        req_dir.mkdir(parents=True, exist_ok=True)
        (req_dir / "empty.zip").write_bytes(b"")

        response = test_client.get("/downloads/req_empty/empty.zip")
        # FastAPI serves empty files with 200 or 206
        assert response.status_code in (200, 206)
