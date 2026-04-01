"""Auth router: Google OAuth2 login, token exchange, and profile."""

import logging

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user, get_current_user_with_token
from auth.google_auth import exchange_code_for_tokens, get_google_auth_url, get_user_info
from auth.jwt_handler import create_session_token
from models.auth import CallbackRequest, TokenResponse, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/login")
async def login() -> dict:
    """Return the Google OAuth2 authorization URL (standard login entry point)."""
    return {"auth_url": get_google_auth_url()}


@router.get("/google/url")
async def google_url() -> dict:
    """Return the Google OAuth2 authorization URL."""
    url = get_google_auth_url()
    return {"url": url}


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)) -> dict:
    """Invalidate the current session (client should discard the JWT)."""
    logger.debug("POST /auth/logout for email=%s", current_user.email)
    return {"success": True}


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(body: CallbackRequest) -> TokenResponse:
    """Exchange a Google authorization code for a signed session JWT."""
    logger.info("OAuth callback: exchanging code for tokens")
    tokens = await exchange_code_for_tokens(body.code)
    user_info = await get_user_info(tokens["access_token"])
    logger.info("User authenticated: email=%s", user_info["email"])

    jwt_token = create_session_token(
        user_id=user_info.get("sub", user_info["email"]),
        email=user_info["email"],
        google_token=tokens["access_token"],
        name=user_info["name"],
        picture=user_info.get("picture"),
    )

    user = User(
        email=user_info["email"],
        name=user_info["name"],
        picture=user_info.get("picture"),
    )
    return TokenResponse(token=jwt_token, user=user)


@router.get("/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the profile of the currently authenticated user."""
    logger.debug("GET /auth/me for email=%s", current_user.email)
    return current_user
