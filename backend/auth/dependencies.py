"""FastAPI dependency injection helpers for authenticated routes."""

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.jwt_handler import extract_access_token, verify_session_token
from models.auth import User

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """Verify the Bearer JWT and return the authenticated User."""
    payload = verify_session_token(credentials.credentials)
    try:
        user = User(
            id=payload["sub"],
            email=payload["email"],
            name=payload.get("name", ""),
            picture=payload.get("picture"),
        )
    except KeyError as exc:
        logger.warning("Session payload missing required field: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.debug("Authenticated user email=%s", user.email)
    return user


async def get_current_user_with_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> tuple[User, str]:
    """Verify the Bearer JWT and return (User, google_access_token).

    Used by routes that need to forward the Google access token when
    calling Google APIs on behalf of the authenticated user.
    """
    payload = verify_session_token(credentials.credentials)
    google_access_token = extract_access_token(payload)
    try:
        user = User(
            id=payload["sub"],
            email=payload["email"],
            name=payload.get("name", ""),
            picture=payload.get("picture"),
        )
    except KeyError as exc:
        logger.warning("Session payload missing required field: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.debug("Authenticated user email=%s with Google token", user.email)
    return user, google_access_token
