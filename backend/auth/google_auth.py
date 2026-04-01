"""Google OAuth2 flow: authorization URL, token exchange, user info."""

import logging
import os
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv()  # ensure .env is loaded even outside uvicorn

from config import get_settings

logger = logging.getLogger(__name__)

# Step 4: log redirect_uri at startup so mismatches are immediately visible
logger.info("GOOGLE_REDIRECT_URI = %s", os.getenv("GOOGLE_REDIRECT_URI"))

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth"

SCOPES = "openid email profile https://www.googleapis.com/auth/cloud-platform.read-only"


def get_google_auth_url() -> str:
    """Build the Google OAuth2 authorization URL."""
    settings = get_settings()
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": secrets.token_urlsafe(16),
        }
    )
    url = f"{GOOGLE_AUTH_BASE}?{params}"
    logger.debug("Built Google auth URL")
    return url


async def exchange_code_for_tokens(code: str) -> dict[str, Any]:
    """Exchange an authorization code for Google OAuth2 tokens."""
    settings = get_settings()
    payload = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    logger.info("Exchanging authorization code for tokens")
    async with httpx.AsyncClient() as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=payload)

    if response.status_code != 200:
        try:
            error_body = response.json()
        except Exception:
            error_body = {}
        logger.error(
            "Google token exchange failed: status=%s error=%s description=%s",
            response.status_code,
            error_body.get("error"),
            error_body.get("error_description"),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Google OAuth token exchange failed",
                "google_error": error_body.get("error"),
                "google_error_description": error_body.get("error_description"),
            },
        )

    data = response.json()
    logger.info("Token exchange succeeded")
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "id_token": data.get("id_token"),
        "expires_in": data.get("expires_in"),
        "token_type": data.get("token_type", "Bearer"),
    }


async def get_user_info(access_token: str) -> dict[str, Any]:
    """Fetch the authenticated user's profile from Google (v3 endpoint)."""
    logger.info("Fetching user info from Google")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != 200:
        logger.warning("Failed to fetch user info: HTTP %s", response.status_code)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to fetch user info from Google",
        )

    data = response.json()
    return {
        "email": data["email"],
        "name": data.get("name", ""),
        "picture": data.get("picture"),
    }
