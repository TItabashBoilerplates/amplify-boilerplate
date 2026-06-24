"""SQLModel engine and session dependency.

Reads the connection string from `POSTGRES_URL` (the canonical env var used
across this monorepo, see `env/backend/.env.local`) and exposes a
synchronous Session via FastAPI dependency injection.

SQLModel does not yet have official async support
(see https://github.com/fastapi/sqlmodel/issues/654), so all DB operations
are kept synchronous. Async path operations may still inject this Session;
FastAPI runs the surrounding request handler in a worker thread when needed.
"""

import os
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, create_engine

from core.exceptions import ConfigurationError

_POSTGRES_URL = os.getenv("POSTGRES_URL")
if not _POSTGRES_URL:
    msg = "POSTGRES_URL environment variable is not set"
    raise ConfigurationError(msg)

# `SQL_ECHO=1` enables verbose query logging — off by default to avoid
# leaking values into structured logs in production.
_SQL_ECHO = os.getenv("SQL_ECHO", "").lower() in {"1", "true", "yes"}

engine = create_engine(
    _POSTGRES_URL,
    echo=_SQL_ECHO,
    pool_pre_ping=True,
)


def get_session() -> Generator[Session]:
    """Yield a SQLModel Session scoped to the current request."""
    with Session(engine) as session:
        yield session


DBSessionDep = Annotated[Session, Depends(get_session)]
