"""Create and verify signed JWTs for session management."""

import logging
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt

load_dotenv()  # safety net: ensures .env is loaded even when run outside uvicorn

from config import get_settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def create_session_token(
    user_id: str,
    email: str,
    google_token: str,
    name: str = "",
    picture: str | None = None,
) -> str:
    """Sign a session JWT embedding the user identity and their Google access token."""
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "access_token": google_token,
        "exp": now + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    logger.debug("Created session token for user_id=%s email=%s", user_id, email)
    return token


def verify_session_token(token: str) -> dict:
    """Decode and verify a session JWT. Raises 401 on any failure."""
    settings = get_settings()
    try:
        payload: dict = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        logger.debug("Session token verified for sub=%s", payload.get("sub"))
        return payload
    except ExpiredSignatureError:
        logger.info("Session token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as exc:
        logger.warning("Session token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def extract_access_token(session_payload: dict) -> str:
    """Pull the stored Google access token out of a verified session payload."""
    google_token: str | None = session_payload.get("access_token")
    if not google_token:
        logger.warning("Session payload missing google_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session does not contain a Google access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return google_token
