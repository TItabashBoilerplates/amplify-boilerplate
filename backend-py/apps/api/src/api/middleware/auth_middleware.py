"""Bearer-token authentication dependency.

Validates the `Authorization: Bearer <token>` header against Supabase Auth
and exposes the resolved `User` as a FastAPI dependency.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from supabase_auth.types import User

from core.exceptions import AuthenticationError, ConfigurationError
from core.logging import get_logger
from core.supabase_client import SupabaseClient

authorization_header = APIKeyHeader(name="Authorization", auto_error=True)
logger = get_logger(__name__)

_BEARER_PREFIX = "Bearer "
_INVALID_HEADER = "Invalid authorization header format"
_UNAUTHORIZED = "Unauthorized"


def _unauthorized(detail: str = _UNAUTHORIZED) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


def _extract_bearer_token(auth_header: str) -> str:
    if not auth_header.startswith(_BEARER_PREFIX):
        raise _unauthorized(_INVALID_HEADER)
    token = auth_header.removeprefix(_BEARER_PREFIX).strip()
    if not token:
        raise _unauthorized(_INVALID_HEADER)
    return token


def _fetch_supabase_user(token: str) -> User | None:
    """Call Supabase and translate domain errors into HTTPException."""
    try:
        return SupabaseClient(access_token=token).get_user()
    except ConfigurationError:
        logger.exception("Supabase client configuration error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error",
        ) from None
    except AuthenticationError:
        logger.warning("Authentication failed")
        raise _unauthorized() from None


def _resolve_user(token: str) -> User:
    user = _fetch_supabase_user(token)
    if user is None:
        raise _unauthorized()
    return user


async def verify_token(
    auth_header: Annotated[str, Depends(authorization_header)],
) -> User:
    """Validate the Bearer token and return the authenticated Supabase user."""
    token = _extract_bearer_token(auth_header)
    return _resolve_user(token)


CurrentUserDep = Annotated[User, Depends(verify_token)]
