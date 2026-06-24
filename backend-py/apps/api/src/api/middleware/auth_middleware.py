"""Bearer-token authentication dependency (Amazon Cognito).

Validates the `Authorization: Bearer <token>` header as a Cognito JWT
(access or id token) by verifying its signature against the User Pool's JWKS
and checking issuer / audience / expiry. Exposes the resolved user as a
FastAPI dependency.

Required environment (injected by the Amplify backend, see
`amplify/functions/api/resource.ts`):
    COGNITO_USER_POOL_ID   e.g. "ap-northeast-1_xxxxxxx"
    COGNITO_APP_CLIENT_ID  Cognito app client id (audience / client_id)
    AWS_REGION             Lambda runtime provides this automatically
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from jwt import PyJWKClient

from core.exceptions import ConfigurationError
from core.logging import get_logger

authorization_header = APIKeyHeader(name="Authorization", auto_error=True)
logger = get_logger(__name__)

_BEARER_PREFIX = "Bearer "
_INVALID_HEADER = "Invalid authorization header format"
_UNAUTHORIZED = "Unauthorized"


@dataclass(frozen=True)
class CognitoUser:
    """Authenticated principal resolved from a Cognito JWT."""

    user_id: str
    username: str
    email: str | None


def _unauthorized(detail: str = _UNAUTHORIZED) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        msg = f"{name} environment variable is not set"
        raise ConfigurationError(msg)
    return value


@lru_cache(maxsize=1)
def _issuer() -> str:
    region = _require_env("AWS_REGION")
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")
    return f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    # JWKS is cached by PyJWKClient; one instance is reused across invocations.
    return PyJWKClient(f"{_issuer()}/.well-known/jwks.json")


def _extract_bearer_token(auth_header: str) -> str:
    if not auth_header.startswith(_BEARER_PREFIX):
        raise _unauthorized(_INVALID_HEADER)
    token = auth_header.removeprefix(_BEARER_PREFIX).strip()
    if not token:
        raise _unauthorized(_INVALID_HEADER)
    return token


def _verify_audience(claims: dict[str, Any], client_id: str) -> None:
    """Cognito access tokens carry `client_id`; id tokens carry `aud`."""
    token_use = claims.get("token_use")
    expected = claims.get("aud") if token_use == "id" else claims.get("client_id")
    if expected != client_id:
        raise _unauthorized()


def _decode(token: str) -> dict[str, Any]:
    """Verify the Cognito JWT signature and standard claims."""
    client_id = _require_env("COGNITO_APP_CLIENT_ID")
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        claims: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_issuer(),
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        logger.warning("JWT verification failed")
        raise _unauthorized() from None

    _verify_audience(claims, client_id)
    return claims


async def verify_token(
    auth_header: Annotated[str, Depends(authorization_header)],
) -> CognitoUser:
    """Validate the Bearer token and return the authenticated Cognito user."""
    token = _extract_bearer_token(auth_header)
    claims = _decode(token)
    return CognitoUser(
        user_id=claims["sub"],
        username=claims.get("username") or claims.get("cognito:username") or claims["sub"],
        email=claims.get("email"),
    )


CurrentUserDep = Annotated[CognitoUser, Depends(verify_token)]
