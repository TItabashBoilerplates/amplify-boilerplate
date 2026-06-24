# mcp-server

`backend-py` モノレポ内の MCP (Model Context Protocol) サーバ。公式
[Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk) (`mcp[cli]`) の
**FastMCP** ベースの最小実装が入っており、汎用ツール / AI ツールを足して拡張していく雛形。

REST API (`apps/api`, FastAPI) と同じ uv workspace モノレポの一員で、共有ライブラリ
`packages/core`（logging / 例外）を利用する。

## 構成

```
apps/mcp/
├── pyproject.toml              # name=mcp-server, [project.scripts] mcp-server=...
├── src/mcp_server/
│   ├── __init__.py
│   └── main.py                 # FastMCP サーバ本体（tools / resource / main()）
└── tests/                      # __init__.py は置かない（python-monorepo 規約）
    └── test_tools.py
```

`main.py` が公開するもの:

| 種別 | 名前 | 用途 |
|---|---|---|
| tool | `ping` | ヘルスチェック（汎用） |
| tool | `add` | 整数加算（汎用ツールの例） |
| tool | `generate` | **AI 拡張ポイント**（現状スタブ。LangChain + Bedrock に差し替える） |
| resource | `config://info` | サーバメタdata（resource の例） |

## 起動

```bash
# devenv script（推奨）— streamable-http で :4041 に起動
dev-mcp

# 直接
cd backend-py && uv run --package mcp-server mcp-server
```

> `main()` は `transport="streamable-http"`。stdio クライアント（デスクトップ MCP ツール等）に
> 組み込む場合は `mcp.run(transport="stdio")` に変更する。MCP Inspector で試すなら
> `uv run mcp dev apps/mcp/src/mcp_server/main.py`。

## 拡張方法

### 1) 汎用ツールを足す（DB / 外部 API / ビジネスロジックを MCP 公開）

```python
@mcp.tool()
def get_order(order_id: str) -> dict[str, str]:
    """注文を取得する."""
    ...  # gateway / 外部 API を呼ぶ
```

### 2) AI ツールにする（LangChain + Amazon Bedrock）

`generate` の中身を実装する。本リポジトリの LLM 方針は **LangChain 経由**
（`.claude/rules/backend-py.md` の LLM Client Policy）。Bedrock の権限・配線は
`amplify-gen2` スキルの `references/aws-services.md` を参照。

```python
# uv add --package mcp-server langchain-aws  したうえで:
from langchain_aws import ChatBedrockConverse

@mcp.tool()
def generate(prompt: str) -> str:
    """プロンプトから生成する."""
    llm = ChatBedrockConverse(model="anthropic.claude-3-5-haiku-20241022-v1:0")
    return llm.invoke(prompt).content
```

依存追加は uv workspace 規約に従い `uv add --package mcp-server <pkg>`
（`.claude/rules/python-monorepo.md`）。

## 共有パッケージ

logging / 共通例外は `packages/core`:

```python
from core.logging import get_logger
from core.exceptions import ConfigurationError
```

## 品質チェック・テスト

すべて devenv 経由（`.claude/rules/commands.md`）。MCP のテストは root の `testpaths` に
`apps/mcp/tests` を登録済みなので横断コマンドに含まれる:

```bash
lint-backend-py        # ruff (apps packages)
type-check-backend-py  # mypy
test-backend-py        # pytest（api + mcp + core）
```

## デプロイ（未配線）

現状 MCP サーバはローカル実行のみ。Amplify(Lambda) 上での公開（Streamable HTTP transport を
custom function + Function URL 化）は今後の対応。REST API (`apps/api`) の Lambda 配線
（`amplify/functions/api`）が参考になる。
