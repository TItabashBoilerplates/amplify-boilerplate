"""API-specific domain exceptions.

`AuthenticationError` と `ConfigurationError` は `core.exceptions` に集約し、
ここからは re-export することで API 側の import surface (`api.domain.exceptions`)
を維持する。API 固有の例外 (`ResourceNotFoundError` 等) はここで定義する。
"""

from core.exceptions import AuthenticationError, ConfigurationError

__all__ = ["AuthenticationError", "ConfigurationError", "ResourceNotFoundError"]


class ResourceNotFoundError(Exception):
    """Raised when a requested resource is not found."""
