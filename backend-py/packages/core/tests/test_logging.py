"""Logging infrastructure tests."""

import logging
import os
import sys
from unittest.mock import patch

import structlog


class TestGetLogLevel:
    """Tests for get_log_level function."""

    def test_default_level_is_info(self):
        """Default log level should be INFO when LOG_LEVEL is not set."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("LOG_LEVEL", None)
            # Re-import to get fresh value
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.get_log_level() == logging.INFO

    def test_debug_level(self):
        """LOG_LEVEL=DEBUG should return DEBUG level."""
        with patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"}):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.get_log_level() == logging.DEBUG

    def test_warning_level(self):
        """LOG_LEVEL=WARNING should return WARNING level."""
        with patch.dict(os.environ, {"LOG_LEVEL": "WARNING"}):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.get_log_level() == logging.WARNING

    def test_case_insensitive(self):
        """LOG_LEVEL should be case insensitive."""
        with patch.dict(os.environ, {"LOG_LEVEL": "error"}):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.get_log_level() == logging.ERROR

    def test_invalid_level_defaults_to_info(self):
        """Invalid LOG_LEVEL should default to INFO."""
        with patch.dict(os.environ, {"LOG_LEVEL": "INVALID"}):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.get_log_level() == logging.INFO


class TestIsDevelopment:
    """Tests for is_development function."""

    def test_tty_returns_true(self):
        """When stderr is a TTY, should return True."""
        with (
            patch.object(sys.stderr, "isatty", return_value=True),
            patch.dict(os.environ, {}, clear=True),
        ):
            os.environ.pop("LOG_FORMAT", None)
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.is_development() is True

    def test_log_format_pretty_returns_true(self):
        """When LOG_FORMAT=pretty, should return True."""
        with (
            patch.object(sys.stderr, "isatty", return_value=False),
            patch.dict(os.environ, {"LOG_FORMAT": "pretty"}),
        ):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.is_development() is True

    def test_non_tty_and_json_format_returns_false(self):
        """When not TTY and LOG_FORMAT=json, should return False."""
        with (
            patch.object(sys.stderr, "isatty", return_value=False),
            patch.dict(os.environ, {"LOG_FORMAT": "json"}),
        ):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            assert core.logging.is_development() is False


class TestRequestContext:
    """Tests for request context management."""

    def test_set_and_get_request_context(self):
        """Should set and retrieve request context."""
        from core.logging import (
            clear_request_context,
            request_id_var,
            set_request_context,
            user_id_var,
        )

        clear_request_context()

        set_request_context("req-123", "user-456")

        assert request_id_var.get() == "req-123"
        assert user_id_var.get() == "user-456"

        clear_request_context()

    def test_set_request_context_without_user_id(self):
        """Should set request context without user_id."""
        from core.logging import (
            clear_request_context,
            request_id_var,
            set_request_context,
            user_id_var,
        )

        clear_request_context()

        set_request_context("req-789")

        assert request_id_var.get() == "req-789"
        assert user_id_var.get() is None

        clear_request_context()

    def test_clear_request_context(self):
        """Should clear all request context."""
        from core.logging import (
            clear_request_context,
            request_id_var,
            set_request_context,
            user_id_var,
        )

        set_request_context("req-abc", "user-def")
        clear_request_context()

        assert request_id_var.get() is None
        assert user_id_var.get() is None


class TestAddRequestContext:
    """Tests for add_request_context processor."""

    def test_adds_request_id_to_event_dict(self):
        """Should add request_id to event dict when set."""
        from typing import Any

        from core.logging import (
            add_request_context,
            clear_request_context,
            request_id_var,
        )

        clear_request_context()
        request_id_var.set("test-request-id")

        event_dict: dict[str, Any] = {"event": "test"}
        result = add_request_context(None, "", event_dict)

        assert result["request_id"] == "test-request-id"
        clear_request_context()

    def test_adds_user_id_to_event_dict(self):
        """Should add user_id to event dict when set."""
        from typing import Any

        from core.logging import (
            add_request_context,
            clear_request_context,
            request_id_var,
            user_id_var,
        )

        clear_request_context()
        request_id_var.set("test-request-id")
        user_id_var.set("test-user-id")

        event_dict: dict[str, Any] = {"event": "test"}
        result = add_request_context(None, "", event_dict)

        assert result["user_id"] == "test-user-id"
        clear_request_context()

    def test_does_not_add_when_not_set(self):
        """Should not add fields when context is not set."""
        from typing import Any

        from core.logging import add_request_context, clear_request_context

        clear_request_context()

        event_dict: dict[str, Any] = {"event": "test"}
        result = add_request_context(None, "", event_dict)

        assert "request_id" not in result
        assert "user_id" not in result


class TestGetLogger:
    """Tests for get_logger function."""

    def test_returns_bound_logger(self):
        """Should return a structlog BoundLogger."""
        from core.logging import configure_logging, get_logger

        configure_logging()
        logger = get_logger("test.module")

        # Should be a BoundLogger that supports standard log methods
        assert hasattr(logger, "info")
        assert hasattr(logger, "debug")
        assert hasattr(logger, "warning")
        assert hasattr(logger, "error")
        assert hasattr(logger, "exception")

    def test_logger_with_no_name(self):
        """Should return logger without name."""
        from core.logging import configure_logging, get_logger

        configure_logging()
        logger = get_logger()

        assert hasattr(logger, "info")


class TestConfigureLogging:
    """Tests for configure_logging function."""

    def test_configures_structlog(self):
        """Should configure structlog without errors."""
        from core.logging import configure_logging

        # Should not raise any exceptions
        configure_logging()

        # Verify structlog is configured
        config = structlog.get_config()
        assert config["processors"] is not None
        assert len(config["processors"]) > 0

    def test_development_mode_uses_console_renderer(self):
        """In development mode, should use ConsoleRenderer."""
        with (
            patch.object(sys.stderr, "isatty", return_value=True),
            patch.dict(os.environ, {}, clear=True),
        ):
            os.environ.pop("LOG_FORMAT", None)
            import importlib

            import core.logging

            importlib.reload(core.logging)
            core.logging.configure_logging()

            config = structlog.get_config()
            # Last processor should be ConsoleRenderer in dev mode
            last_processor = config["processors"][-1]
            assert isinstance(last_processor, structlog.dev.ConsoleRenderer)

    def test_production_mode_uses_json_renderer(self):
        """In production mode, should use JSONRenderer."""
        with (
            patch.object(sys.stderr, "isatty", return_value=False),
            patch.dict(os.environ, {"LOG_FORMAT": "json"}),
        ):
            import importlib

            import core.logging

            importlib.reload(core.logging)
            core.logging.configure_logging()

            config = structlog.get_config()
            # Last processor should be JSONRenderer in prod mode
            last_processor = config["processors"][-1]
            assert isinstance(last_processor, structlog.processors.JSONRenderer)
