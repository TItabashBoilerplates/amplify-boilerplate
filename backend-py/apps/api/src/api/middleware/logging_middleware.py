"""FastAPI request logging middleware."""

import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from core.logging import clear_request_context, get_logger, set_request_context

logger = get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Request logging middleware."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Process request and output logs."""
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        user_id = getattr(request.state, "user_id", None)

        set_request_context(request_id, user_id)

        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query=str(request.query_params),
        )

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                "Request completed",
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )

            response.headers["x-request-id"] = request_id
            return response  # noqa: TRY300

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Request failed",
                error=str(e),
                duration_ms=round(duration_ms, 2),
            )
            raise

        finally:
            clear_request_context()
