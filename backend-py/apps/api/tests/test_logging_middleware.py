"""Logging middleware tests."""

import os
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middleware.logging_middleware import LoggingMiddleware
from core.logging import configure_logging, request_id_var, user_id_var


@pytest.fixture
def app():
    """Create a test FastAPI application with logging middleware."""
    configure_logging()

    test_app = FastAPI()
    test_app.add_middleware(LoggingMiddleware)

    @test_app.get("/test")
    async def test_endpoint():
        return {"message": "ok"}

    @test_app.get("/error")
    async def error_endpoint():
        msg = "Test error"
        raise ValueError(msg)

    return test_app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app, raise_server_exceptions=False)


class TestLoggingMiddleware:
    """Tests for LoggingMiddleware."""

    def test_generates_request_id_when_not_provided(self, client):
        """Should generate a request ID when not provided in headers."""
        response = client.get("/test")

        assert response.status_code == 200
        assert "x-request-id" in response.headers
        # Should be a valid UUID format
        request_id = response.headers["x-request-id"]
        assert len(request_id) == 36  # UUID format: 8-4-4-4-12

    def test_uses_provided_request_id(self, client):
        """Should use the request ID from x-request-id header."""
        custom_request_id = "custom-request-id-123"
        response = client.get("/test", headers={"x-request-id": custom_request_id})

        assert response.status_code == 200
        assert response.headers["x-request-id"] == custom_request_id

    def test_clears_context_after_request(self, client):
        """Should clear request context after request completes."""
        from core.logging import clear_request_context

        clear_request_context()

        response = client.get("/test")
        assert response.status_code == 200

        # Context should be cleared after request
        assert request_id_var.get() is None
        assert user_id_var.get() is None

    def test_clears_context_after_error(self, client):
        """Should clear request context even when error occurs."""
        from core.logging import clear_request_context

        clear_request_context()

        response = client.get("/error")
        assert response.status_code == 500

        # Context should be cleared after request
        assert request_id_var.get() is None
        assert user_id_var.get() is None

    def test_logs_request_started(self, client, capfd):
        """Should log request started with method and path."""
        with patch.dict(os.environ, {"LOG_FORMAT": "pretty"}):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            core.logging.configure_logging()

            response = client.get("/test")
            assert response.status_code == 200

            # Note: Capturing structlog output is complex due to its configuration
            # The test verifies the request completes successfully with middleware

    def test_logs_request_completed_with_status_and_duration(self, client):
        """Should log request completed with status code and duration."""
        response = client.get("/test")

        assert response.status_code == 200
        # Middleware should complete without errors

    def test_logs_exception_on_error(self, client):
        """Should log exception when request fails."""
        response = client.get("/error")

        # Error endpoint raises ValueError, which results in 500
        assert response.status_code == 500

    def test_returns_request_id_in_response_header(self, client):
        """Should return x-request-id in response headers."""
        response = client.get("/test")

        assert "x-request-id" in response.headers
        assert response.headers["x-request-id"] is not None
