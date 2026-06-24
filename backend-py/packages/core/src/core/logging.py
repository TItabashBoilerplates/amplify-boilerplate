"""Unified logging configuration module.

Provides structured logging using structlog.
Development environment uses colored output, production uses JSON output.
"""

import logging
import os
import sys
from collections.abc import MutableMapping
from contextvars import ContextVar
from typing import Any

import orjson
import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars

# Context variables
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)


def get_log_level() -> int:
    """Get log level from environment variable."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, level_name, logging.INFO)


def is_development() -> bool:
    """Determine if running in development environment."""
    return sys.stderr.isatty() or os.getenv("LOG_FORMAT", "pretty") == "pretty"


def add_request_context(
    logger: structlog.types.WrappedLogger,  # noqa: ARG001
    method_name: str,  # noqa: ARG001
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    """Add request context to log processor.

    Args:
        logger: The wrapped logger (structlog processor interface).
        method_name: The name of the log method (structlog interface).
        event_dict: The event dictionary to modify.

    Returns:
        The modified event dictionary with request context added.
    """
    request_id = request_id_var.get()
    user_id = user_id_var.get()

    if request_id:
        event_dict["request_id"] = request_id
    if user_id:
        event_dict["user_id"] = user_id

    return event_dict


def configure_logging() -> None:
    """Configure structlog."""
    if is_development():
        # Development: colored console output
        # Note: ConsoleRenderer handles exception formatting, so format_exc_info
        # is not needed and would cause duplicate output
        processors: list[structlog.types.Processor] = [
            structlog.contextvars.merge_contextvars,
            add_request_context,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer(colors=True),
        ]
        structlog.configure(
            processors=processors,
            wrapper_class=structlog.make_filtering_bound_logger(get_log_level()),
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Production: JSON output (using orjson for performance)
        processors = [
            structlog.contextvars.merge_contextvars,
            add_request_context,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(serializer=orjson.dumps),
        ]
        structlog.configure(
            processors=processors,
            wrapper_class=structlog.make_filtering_bound_logger(get_log_level()),
            logger_factory=structlog.BytesLoggerFactory(),
            cache_logger_on_first_use=True,
        )

    # Route standard logging through structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=get_log_level(),
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a logger instance.

    Returns:
        A structlog BoundLogger instance.
    """
    return structlog.get_logger(name)  # type: ignore[no-any-return]


def set_request_context(request_id: str, user_id: str | None = None) -> None:
    """Set request context."""
    clear_contextvars()
    request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    bind_contextvars(request_id=request_id)
    if user_id:
        bind_contextvars(user_id=user_id)


def clear_request_context() -> None:
    """Clear request context."""
    clear_contextvars()
    request_id_var.set(None)
    user_id_var.set(None)
