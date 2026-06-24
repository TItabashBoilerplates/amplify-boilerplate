# Python/FastAPI structlog ロギング調査レポート

## 調査情報

- **調査日**: 2026-01-10
- **調査者**: spec agent
- **対象**: structlog + FastAPI + uvicorn のベストプラクティス

## バージョン情報

| パッケージ | 現在使用中 | 最新バージョン | 推奨バージョン |
|-----------|-----------|---------------|---------------|
| structlog | 指定なし | 25.5.0 (2025-10-27) | 25.5.0 |
| asgi-correlation-id | 未使用 | 4.x | 4.x |
| orjson | 3.10.14 | 3.10.x | 3.10.14 (互換性維持) |

## 破壊的変更

### structlog 25.x の変更点

- `ConsoleRenderer` の `pad_event` パラメータが `pad_event_to` にリネーム（deprecated）
- Python 3.8+ が必須（Python 3.7 サポート終了）
- `min_level` が文字列でも指定可能に（"info", "debug" 等）

## ベストプラクティス

### 1. 基本アーキテクチャ

**Twelve-Factor App 準拠**:
- ログは標準出力（stdout）に出力
- ファイル書き込みやローテーションはアプリケーションで管理しない
- 外部ツール（Datadog, ELK, Graylog）にログ収集を委譲

**Canonical Log Lines パターン**:
- リクエストあたり最小限のログエントリ
- コンテキスト情報はバインドして自動付与

### 2. 環境別レンダラー設定

| 環境 | レンダラー | 目的 |
|------|-----------|------|
| 開発 | `ConsoleRenderer` | 人間可読、カラー表示 |
| 本番 | `JSONRenderer` | 機械解析可能、ログ集約システム向け |

**判定方法**:
```python
# 方法1: 環境変数で明示的に指定（推奨）
json_logs = os.getenv("LOG_JSON_FORMAT", "false").lower() == "true"

# 方法2: TTY 判定（開発環境は通常 TTY あり）
import sys
json_logs = not sys.stderr.isatty()
```

### 3. 推奨プロセッサチェーン

```python
import logging
import structlog

# 共有プロセッサ（すべての環境で使用）
shared_processors: list[structlog.types.Processor] = [
    structlog.contextvars.merge_contextvars,      # コンテキスト変数マージ（最初に配置）
    structlog.stdlib.add_logger_name,             # ロガー名追加
    structlog.stdlib.add_log_level,               # ログレベル追加
    structlog.stdlib.PositionalArgumentsFormatter(),  # %-style フォーマット対応
    structlog.stdlib.ExtraAdder(),                # extra パラメータ対応
    structlog.processors.TimeStamper(fmt="iso", utc=True),  # ISO 8601 UTC タイムスタンプ
    structlog.processors.StackInfoRenderer(),     # スタック情報
]

# 本番環境用追加プロセッサ
if json_logs:
    processors = shared_processors + [
        structlog.processors.format_exc_info,     # 例外情報をフォーマット
        structlog.processors.JSONRenderer(serializer=orjson.dumps),
    ]
else:
    processors = shared_processors + [
        structlog.dev.ConsoleRenderer(colors=True),
    ]
```

### 4. uvicorn との連携

**重要**: uvicorn は独自の logging 設定を持つため、統一が必要。

#### 方法A: uvicorn のログを structlog で処理（推奨）

```python
import logging
import structlog

def setup_logging(json_logs: bool = False, log_level: str = "INFO") -> None:
    """structlog と標準ライブラリ logging を統合設定."""

    # タイムスタンプ設定
    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    # 共有プロセッサ
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.stdlib.ExtraAdder(),
        timestamper,
        structlog.processors.StackInfoRenderer(),
    ]

    if json_logs:
        # 本番: JSON 出力
        structlog.configure(
            processors=shared_processors + [
                structlog.processors.format_exc_info,
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )

        log_renderer = structlog.processors.JSONRenderer(
            serializer=orjson.dumps,
        )
    else:
        # 開発: コンソール出力
        structlog.configure(
            processors=shared_processors + [
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )

        log_renderer = structlog.dev.ConsoleRenderer(colors=True)

    # ProcessorFormatter で標準 logging と統合
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            log_renderer,
        ],
    )

    # ルートロガー設定
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # uvicorn ロガーの設定
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
```

#### 方法B: uvicorn のアクセスログを無効化してミドルウェアで再実装

```json
// uvicorn_logging_config.json
{
    "version": 1,
    "disable_existing_loggers": false,
    "handlers": {
        "default": {"class": "logging.NullHandler"},
        "access": {"class": "logging.NullHandler"}
    },
    "loggers": {
        "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": false}
    }
}
```

### 5. リクエスト/レスポンスログミドルウェア

```python
import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    """リクエスト/レスポンスのログを構造化して出力するミドルウェア."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # コンテキストをクリア（リクエスト開始時）
        structlog.contextvars.clear_contextvars()

        # リクエスト ID を生成またはヘッダーから取得
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # コンテキストにバインド
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_host=request.client.host if request.client else None,
        )

        start_time = time.perf_counter()

        try:
            response = await call_next(request)

            process_time_ms = (time.perf_counter() - start_time) * 1000

            # アクセスログ出力
            logger.info(
                "Request completed",
                status_code=response.status_code,
                duration_ms=round(process_time_ms, 2),
            )

            # レスポンスヘッダーにリクエスト ID を追加
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception:
            process_time_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Request failed",
                duration_ms=round(process_time_ms, 2),
            )
            raise
```

### 6. asgi-correlation-id との連携（推奨）

**インストール**:
```bash
uv add asgi-correlation-id
```

**設定**:
```python
from asgi_correlation_id import CorrelationIdMiddleware
from asgi_correlation_id.context import correlation_id
from fastapi import FastAPI

import structlog

app = FastAPI()

# ミドルウェアの順序が重要（後から追加したものが先に実行される）
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CorrelationIdMiddleware,
    header_name="X-Request-ID",
    update_request_header=True,
)


class CorrelationIdLoggingMiddleware:
    """correlation_id を structlog コンテキストにバインドする."""

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            structlog.contextvars.clear_contextvars()
            structlog.contextvars.bind_contextvars(
                request_id=correlation_id.get(),
            )
        await self.app(scope, receive, send)
```

### 7. ログレベルの環境変数制御

```python
import os
import logging

def get_log_level() -> int:
    """環境変数からログレベルを取得."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, level_name, logging.INFO)


def is_json_logs() -> bool:
    """JSON ログ出力が有効か判定."""
    # 明示的な環境変数を優先
    env_value = os.getenv("LOG_JSON_FORMAT")
    if env_value is not None:
        return env_value.lower() in ("true", "1", "yes")

    # 環境名で判定
    environment = os.getenv("ENVIRONMENT", "development")
    return environment in ("production", "staging")
```

### 8. ユーザー ID の付与パターン

```python
from fastapi import Depends, Request

import structlog

async def get_current_user_id(request: Request) -> str | None:
    """認証情報からユーザー ID を取得."""
    # 実際の認証ロジックに置き換え
    return request.state.user_id if hasattr(request.state, "user_id") else None


def bind_user_context(user_id: str = Depends(get_current_user_id)) -> None:
    """ユーザー ID をログコンテキストにバインド."""
    if user_id:
        structlog.contextvars.bind_contextvars(user_id=user_id)


@router.get("/example")
async def example_endpoint(_: None = Depends(bind_user_context)):
    logger = structlog.get_logger()
    logger.info("This log includes user_id automatically")
```

## 完全な実装例

### ディレクトリ構成

```
backend-py/app/src/
├── infra/
│   └── logging.py          # ロギング設定
├── middleware/
│   └── logging_middleware.py  # ログミドルウェア
└── app.py                  # アプリケーションエントリーポイント
```

### infra/logging.py

```python
"""Structlog ロギング設定モジュール."""

from __future__ import annotations

import logging
import os
import sys
from typing import TYPE_CHECKING

import orjson
import structlog

if TYPE_CHECKING:
    from structlog.types import Processor


def get_log_level() -> int:
    """環境変数からログレベルを取得."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, level_name, logging.INFO)


def is_json_logs() -> bool:
    """JSON ログ出力が有効か判定."""
    env_value = os.getenv("LOG_JSON_FORMAT")
    if env_value is not None:
        return env_value.lower() in ("true", "1", "yes")

    environment = os.getenv("ENVIRONMENT", "development")
    return environment in ("production", "staging")


def setup_logging() -> None:
    """structlog と標準ライブラリ logging を統合設定."""
    json_logs = is_json_logs()
    log_level = get_log_level()

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.stdlib.ExtraAdder(),
        timestamper,
        structlog.processors.StackInfoRenderer(),
    ]

    if json_logs:
        structlog.configure(
            processors=shared_processors + [
                structlog.processors.format_exc_info,
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
        log_renderer: Processor = structlog.processors.JSONRenderer(
            serializer=orjson.dumps,
        )
    else:
        structlog.configure(
            processors=shared_processors + [
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
        log_renderer = structlog.dev.ConsoleRenderer(colors=True)

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            log_renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # uvicorn ロガーを統合
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True


# モジュールレベルでロガーを取得
LOGGER = structlog.get_logger()
```

### middleware/logging_middleware.py

```python
"""リクエスト/レスポンスログミドルウェア."""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class LoggingMiddleware(BaseHTTPMiddleware):
    """リクエスト/レスポンスのログを構造化して出力するミドルウェア."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        logger = structlog.get_logger("http.access")

        structlog.contextvars.clear_contextvars()

        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            http_method=request.method,
            http_path=request.url.path,
            http_query=str(request.query_params) if request.query_params else None,
            client_ip=request.client.host if request.client else None,
        )

        start_time = time.perf_counter()

        try:
            response = await call_next(request)

            duration_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                "Request completed",
                http_status=response.status_code,
                duration_ms=round(duration_ms, 2),
            )

            response.headers["X-Request-ID"] = request_id

            return response

        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Request failed",
                duration_ms=round(duration_ms, 2),
            )
            raise
```

### app.py

```python
"""FastAPI アプリケーションエントリーポイント."""

import uvicorn
from fastapi import FastAPI

from controller import router
from infra.logging import setup_logging
from middleware.logging_middleware import LoggingMiddleware

# ロギング設定（アプリケーション起動前に実行）
setup_logging()

app = FastAPI()

# ミドルウェア追加
app.add_middleware(LoggingMiddleware)

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104
```

## ログ出力例

### 開発環境（ConsoleRenderer）

```
2026-01-10T05:00:00.000000Z [info     ] Request completed              [http.access] client_ip=127.0.0.1 duration_ms=12.34 http_method=GET http_path=/api/users http_status=200 request_id=abc-123
```

### 本番環境（JSONRenderer）

```json
{"timestamp":"2026-01-10T05:00:00.000000Z","level":"info","event":"Request completed","logger":"http.access","request_id":"abc-123","http_method":"GET","http_path":"/api/users","http_status":200,"duration_ms":12.34,"client_ip":"10.0.0.1"}
```

## 追加パッケージ

```bash
# 必須（既にインストール済み）
# structlog, orjson

# 推奨（オプション）
uv add asgi-correlation-id
```

## 参考リンク

- [structlog 公式ドキュメント](https://www.structlog.org/)
- [structlog Getting Started](https://www.structlog.org/en/stable/getting-started.html)
- [structlog Logging Best Practices](https://www.structlog.org/en/stable/logging-best-practices.html)
- [structlog Standard Library Integration](https://www.structlog.org/en/stable/standard-library.html)
- [structlog Context Variables](https://www.structlog.org/en/stable/contextvars.html)
- [structlog PyPI](https://pypi.org/project/structlog/)
- [FastAPI + Structlog + Uvicorn Gist](https://gist.github.com/nymous/f138c7f06062b7c43c060bf03759c29e)
- [fastapi-structlog PyPI](https://pypi.org/project/fastapi-structlog/)
- [asgi-correlation-id GitHub](https://github.com/snok/asgi-correlation-id)
- [Setting Up Structured Logging in FastAPI with structlog](https://ouassim.tech/notes/setting-up-structured-logging-in-fastapi-with-structlog/)
- [Integrating FastAPI with Structlog](https://wazaari.dev/blog/fastapi-structlog-integration)

## 注意事項

### FastAPI/Starlette の contextvars 制限

FastAPI/Starlette のようなハイブリッドアプリケーション（同期・非同期混在）では、同期コンテキストで設定した contextvars が非同期コンテキストで見えない場合があります。

**対策**:
- ミドルウェアで早期に `clear_contextvars()` と `bind_contextvars()` を実行
- 非同期エンドポイント内でのみコンテキストを操作
- `asgi-correlation-id` を使用して一貫したリクエスト ID を保証

### WriteLogger vs PrintLogger

複数のログ出力元（structlog + uvicorn）が同じ stdout を使用する場合は、`PrintLogger` ではなく `WriteLogger` を使用することが推奨されます。`PrintLogger` は print() を使用するため、ログメッセージと改行が別々に書き込まれ、インターリーブが発生する可能性があります。
