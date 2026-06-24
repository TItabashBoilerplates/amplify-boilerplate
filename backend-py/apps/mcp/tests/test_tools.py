"""Unit tests for the backend-mcp tools.

FastMCP's ``@mcp.tool()`` / ``@mcp.resource()`` decorators register the function
and return it unchanged, so the tool functions remain directly callable here.
Importing the module instantiates the FastMCP server but does not start any
transport, so these tests make no network calls.
"""

from mcp_server.main import add, generate, ping, server_info


def test_ping_returns_ok_status() -> None:
    result = ping()
    assert result["status"] == "ok"
    assert result["server"] == "backend-mcp"


def test_add_sums_integers() -> None:
    assert add(2, 3) == 5


def test_generate_stub_echoes_prompt() -> None:
    assert "hello" in generate("hello")


def test_server_info_is_json_like() -> None:
    assert "backend-mcp" in server_info()
