"""FastMCP-based MCP (Model Context Protocol) server for the backend-py monorepo.

A minimal, extensible server built on the official ``mcp[cli]`` SDK (FastMCP).
It ships a couple of generic tools plus an AI extension point (``generate``)
that returns a stub today and is meant to be backed by LangChain / Amazon
Bedrock when AI features are added — see ``apps/mcp/README.md`` and the
``langchain`` / ``amplify-gen2`` (``references/aws-services.md``) skills.

Run locally (streamable HTTP transport):
    uv run --package mcp-server mcp-server   # or: dev-mcp
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from core.logging import get_logger

logger = get_logger(__name__)

# host/port are only used by the HTTP transports (streamable-http / sse).
mcp = FastMCP("backend-mcp", host="0.0.0.0", port=4041)  # noqa: S104


@mcp.tool()
def ping() -> dict[str, str]:
    """Health-check tool — returns the server status."""
    return {"status": "ok", "server": "backend-mcp"}


@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers (generic tool example)."""
    return a + b


@mcp.tool()
def generate(prompt: str) -> str:
    """Generate a response from a prompt (AI extension point).

    Placeholder implementation kept dependency-free so the skeleton runs as-is.
    Replace the body with a real LLM call — e.g. LangChain + Amazon Bedrock
    (see the ``langchain`` skill and ``aws-services.md``). When wiring Bedrock,
    add the dependency with ``uv add --package mcp-server <pkg>``.
    """
    logger.info("generate tool invoked")
    return f"[stub] would generate a response for: {prompt}"


@mcp.resource("config://info")
def server_info() -> str:
    """Expose basic server metadata as an MCP resource."""
    return '{"server": "backend-mcp", "transport": "streamable-http"}'


def main() -> None:
    """Entry point — start the MCP server over the streamable HTTP transport.

    For stdio-based MCP clients (e.g. desktop tools), use
    ``mcp.run(transport="stdio")`` instead.
    """
    logger.info("Starting backend-mcp (streamable-http) on 0.0.0.0:4041")
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
