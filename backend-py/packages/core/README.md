# core

`backend-py` モノレポ内の各サービス (`apps/api`, `apps/mcp`, etc.) から共有される基盤パッケージ。

## 含まれるもの

| モジュール | 役割 |
|---|---|
| `core.logging` | structlog ベースの統一ロガー (`configure_logging` / `get_logger` / リクエストコンテキスト) |
| `core.exceptions` | サービス横断で使うドメイン例外 (`AuthenticationError`, `ConfigurationError`) |
| `core.auth` | Cognito JWT 検証ユーティリティ（User Pool が発行した JWT の検証） |

## 使い方

`pyproject.toml` の `dependencies` に `"core"` を追加し、`[tool.uv.sources] core = { workspace = true }` でワークスペース解決させる（workspace root に既に定義済み）。

```python
from core.logging import get_logger
from core.auth import verify_cognito_jwt
from core.exceptions import AuthenticationError, ConfigurationError
```

## 制約

- `core` は他のワークスペースメンバー (`api`, `mcp-server`) を **import しない**（循環依存禁止）。
- サービス固有のドメインロジック・エンティティはここに置かない。`apps/<service>/src/<service>/domain/` で持つ。
