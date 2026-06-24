"""Supabase client wrapper.

Reads credentials from environment variables and exposes a thin wrapper
around `supabase.Client` that, when given an access token, validates it
against Supabase Auth and exposes the resolved `User`.
"""

import os

from supabase import Client, create_client
from supabase_auth.types import User

from core.exceptions import AuthenticationError, ConfigurationError
from core.logging import get_logger

logger = get_logger(__name__)


class SupabaseClient:
    """Lightweight Supabase client carrying an optional authenticated user."""

    def __init__(self, access_token: str | None = None) -> None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
        if url is None or key is None:
            msg = "SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set"
            raise ConfigurationError(msg)

        self.url: str = url
        self.key: str = key
        self.client: Client = create_client(url, key)
        self.user: User | None = None

        if access_token is not None:
            self._authenticate(access_token)

    def _authenticate(self, access_token: str) -> None:
        try:
            user_response = self.client.auth.get_user(access_token)
        except Exception as e:
            msg = "Failed to get user"
            raise AuthenticationError(msg) from e

        if user_response is None or user_response.user is None:
            msg = "User response is empty"
            raise AuthenticationError(msg)

        self.user = user_response.user
        self.client.postgrest.auth(token=access_token)

    def get_user(self) -> User | None:
        return self.user
