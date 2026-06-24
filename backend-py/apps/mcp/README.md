# mcp-server (skeleton)

`backend-py` モノレポ内の MCP (Model Context Protocol) サーバの**雛形ディレクトリ**。
公式 [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk) (`mcp[cli]`) を依存に持つが、
**現時点では実装なし**。

## 起動

devenv では `backend-mcp` プロセスとして登録されているが、`start.enable = false`（opt-in）で
`devenv up` の自動起動には含まれない。明示的に起動する場合:

```bash
devenv up backend-mcp
```

現状は placeholder メッセージを print するだけ。

## 実装ガイド

実装着手時は以下を行う:

1. `apps/mcp/src/mcp_server/main.py` を新規作成し `FastMCP` ベースのサーバを実装。
   ```python
   from mcp.server.fastmcp import FastMCP

   mcp = FastMCP("backend-mcp")

   @mcp.tool()
   def example_tool(query: str) -> str:
       """サンプルツール."""
       return f"query: {query}"

   def main() -> None:
       mcp.run(transport="streamable-http")
   ```
2. `pyproject.toml` の `[project.scripts]` に `mcp-server = "mcp_server.main:main"` を追加。
3. `devenv.nix` の `backendMcpExec` を `uv run --package mcp-server mcp-server` に差し替え、
   ready probe を有効化。
4. `start.enable = false` を解除して `devenv up` の軽量セットに含めるか、用途に応じて opt-in のまま維持。

## 共有パッケージ

logger / 共通例外は `packages/core/` を利用する:

```python
from core.logging import get_logger
from core.exceptions import ConfigurationError
```
