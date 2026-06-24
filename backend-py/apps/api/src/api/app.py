"""FastAPI application entrypoint.

Wires up structured logging, the request-logging middleware, domain-level
exception handlers, and the aggregated controller router.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from api.controller import router
from api.domain.exceptions import (
    AuthenticationError,
    ConfigurationError,
    ResourceNotFoundError,
)
from api.middleware.logging_middleware import LoggingMiddleware
from core.logging import configure_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize cross-cutting concerns (logging) at startup."""
    configure_logging()
    logger.info("Application startup complete")
    yield
    logger.info("Application shutdown")


app = FastAPI(lifespan=lifespan)
app.add_middleware(LoggingMiddleware)


@app.exception_handler(AuthenticationError)
async def _authentication_error_handler(
    _request: Request, exc: AuthenticationError
) -> JSONResponse:
    logger.warning("Authentication error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": str(exc) or "Unauthorized"},
    )


@app.exception_handler(ResourceNotFoundError)
async def _resource_not_found_handler(
    _request: Request, exc: ResourceNotFoundError
) -> JSONResponse:
    logger.info("Resource not found: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc) or "Resource not found"},
    )


@app.exception_handler(ConfigurationError)
async def _configuration_error_handler(
    _request: Request, exc: ConfigurationError
) -> JSONResponse:
    logger.exception("Configuration error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Server configuration error"},
    )


app.include_router(router)
