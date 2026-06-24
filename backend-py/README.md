# Backend Python (FastAPI)

`backend-py/` は **uv workspace** で構成された Python モノレポ。FastAPI ベースの API サーバを最小スケルトンで、MCP サーバ用の雛形と共有パッケージ (`core`) も含む。

## Workspace 構造

```
backend-py/
├── pyproject.toml          # workspace root（members 定義 + 共通 tooling）
├── uv.lock                 # 単一ルート lockfile（全 member の依存を解決）
├── .python-version         # 3.13
├── apps/
│   ├── api/                # FastAPI + Supabase auth サーバ
│   └── mcp/                # MCP server skeleton（未実装の雛形）
└── packages/
    └── core/               # 全サービスで共有: logger / Supabase client / 共通例外
```

| Member | 役割 | 起動 |
|---|---|---|
| `apps/api` | FastAPI HTTP サーバ | `devenv up` の軽量セットで自動起動 (port 4040) |
| `apps/mcp` | MCP サーバ雛形 | opt-in (`devenv up backend-mcp`) — 実装が入るまで placeholder |
| `packages/core` | 共有ライブラリ | サービスから `from core.X import …` で import |

新しいサービスを追加するときは `apps/<name>/` を 1 つ生やし、`pyproject.toml` の `[tool.uv.workspace] members` に既にマッチ済みなので、`uv lock` を走らせるだけで workspace 化される。

## Overview (apps/api)

`apps/api` は **Clean Architecture** のレイヤー分離を前提に最小構成で立ち上がる:

- `GET /healthcheck` (auth 不要)
- Supabase JWT を検証する `verify_token` 依存（`api/middleware/auth_middleware.py`）
- structlog ベースの構造化ロギング（dev: 色付き / prod: JSON、`core.logging`）
- リクエストログ middleware（`api/middleware/logging_middleware.py`）
- DB / Supabase クライアントの初期化ヘルパ（`api/infra/db_client.py` / `core.supabase_client`）
- 例外クラスのテンプレート（`api/domain/exceptions.py` + `core.exceptions`）

## Tech Stack

- **Framework**: FastAPI
- **Architecture**: Clean Architecture (Controller / UseCase / Gateway / Domain / Infra)
- **ORM**: SQLModel (Sync)
- **Database**: PostgreSQL (Supabase)
- **Package Manager**: uv workspace（単一ルート venv + lockfile）
- **Code Quality**: Ruff (lint+format), MyPy (strict), pytest

## Directory Layout（apps/api）

```
backend-py/apps/api/src/api/
├── app.py                   # FastAPI エントリポイント（lifespan + exception handlers）
├── main.py                  # uvicorn entrypoint（`uv run --package api api`）
├── controller/
│   ├── __init__.py          # ルーター集約
│   └── base_controller.py   # 現状は GET /healthcheck のみ
├── usecase/                 # ビジネスロジック (空)
├── gateway/                 # データアクセス抽象 (空)
├── domain/
│   ├── entity/              # SQLModel エンティティ (空 — 必要に応じて追加)
│   ├── service/             # ドメインサービス (空)
│   ├── const/error_messages.py
│   └── exceptions.py        # ResourceNotFoundError + core 例外の re-export
├── infra/
│   └── db_client.py         # SQLModel session 管理 (Depends で注入)
└── middleware/
    ├── auth_middleware.py   # Bearer token 検証 (Supabase 経由)
    └── logging_middleware.py
```

共有パッケージ:

```
backend-py/packages/core/src/core/
├── logging.py               # structlog 設定 (dev / prod 切替)
├── exceptions.py            # AuthenticationError / ConfigurationError
└── supabase_client.py       # Supabase Auth クライアント
```

`core` の責務は「複数サービスから参照される基盤」のみ。サービス固有のドメインロジック・エンティティは入れない。

## Layer Responsibilities

| Layer | 責務 |
|---|---|
| **Controller** | HTTP の入出力のみ。ビジネスロジックは持たない |
| **UseCase** | 複数 Gateway を協調させてビジネスフローを実装 |
| **Gateway** | データアクセスを抽象化（Sync SQLModel + 外部 API 呼び出し） |
| **Domain** | Entity / Service / 例外 / 定数。外部依存を持たない |
| **Infrastructure** | DB / Supabase / 外部サービスクライアント |
| **Middleware** | 認証 / ロギング / CORS など横断的関心事 |
| **packages/core** | サービス間で共有する基盤 (logger, Supabase client, 共通例外) |

エンティティを追加するときは `apps/api/src/api/domain/entity/` 配下に SQLModel を置き、`domain/entity/__init__.py` で import 順を制御する（FK 依存があるため base から順に）。

## Adding a New Endpoint (例)

```python
# apps/api/src/api/controller/users_controller.py
from typing import Annotated

from fastapi import APIRouter, Depends
from supabase_auth.types import User

from api.middleware.auth_middleware import verify_token

router = APIRouter()


@router.get("/me")
async def me(current_user: Annotated[User, Depends(verify_token)]) -> dict[str, str | None]:
    return {"id": current_user.id, "email": current_user.email}
```

その後 `api/controller/__init__.py` で `include_router(...)` する。Bearer token は `verify_token` の Dependency で検証され、Supabase の `User` が `Depends` で受け取れる。

## Development

すべて devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`) を使用する。Makefile は **deprecated**。直接 `uv run X` の実行は禁止。

### Getting Started

```bash
# Setup
# `devenv shell` 進入 (direnv 経由含む) で setup:install-backend task が
# `cd backend-py && uv sync --all-packages --all-groups --frozen` を自動実行する。
# 明示的な init コマンドは不要。

# Start backend services (軽量セット = Supabase + backend + storybook)
devenv up
# 別組み合わせ: dev-web / dev-mobile / dev-all / `devenv up backend web` 等
```

### Common Commands

```bash
# Linting & Formatting
lint-backend-py              # Ruff lint (auto-fix、apps + packages 全体)
lint-backend-py-ci           # Ruff lint (CI, no fix, execIfModified キャッシュ)
format-backend-py            # Ruff format (auto-fix)
format-backend-py-check      # Ruff format check

# Type Checking
type-check-backend-py        # MyPy (strict mode、apps + packages 全体)

# Testing
test-backend-py              # pytest（workspace 全体: apps/api/tests + packages/core/tests）
unit-test                    # 全 unit test (frontend + backend-py)

# 詳細な pytest オプション (devenv shell 内で uv 経由)
cd "$DEVENV_ROOT/backend-py"
uv run pytest -v                                            # Verbose
uv run pytest -k test_name                                  # 名前指定
uv run pytest --cov=apps/api/src/api --cov=packages/core/src/core --cov-report=term-missing  # Coverage
```

正典: `/.claude/rules/commands.md`

### Package Management (uv workspace)

ワークスペースルート (`backend-py/`) で操作する。各 member の `pyproject.toml` を直接編集しても OK（lockfile はルートで再生成）。

```bash
cd backend-py

uv sync --all-packages --all-groups   # 全 member + dev group をインストール
uv sync --all-packages --no-dev       # 全 member（production のみ）

# member 別の依存追加
uv add --package api <package>        # apps/api/pyproject.toml に追加
uv add --package core <package>       # packages/core/pyproject.toml に追加
uv add --package mcp-server <package> # apps/mcp/pyproject.toml に追加

# dev 依存（workspace root の [dependency-groups].dev に追加）
uv add --dev <package>

uv lock --upgrade                     # ロック更新（全 member 共通）
```

LLM / ベクトル検索 / WebRTC など重い依存は最初から積まない方針。必要になった時点で対応する member に `uv add` で導入する（プロジェクト全体のポリシーは `.claude/rules/supabase-first.md` を参照: バックエンドの既定は **Edge Functions**、backend-py は LLM / 長時間処理 / 複雑実装の escalation 先）。

## Code Quality

### Ruff

- Line length: 88
- Target: Python 3.13
- Max complexity: 3 (McCabe)
- Docstrings: Google
- 設定は workspace root `pyproject.toml` で一元管理（全 member に適用）

### MyPy

- Strict mode 有効
- `mypy_path = apps/api/src:packages/core/src:apps/mcp/src`
- `**/tests/` は exclude

### pytest

- 起点: `apps/api/tests/`, `packages/core/tests/`
- import 方式: `--import-mode=importlib`（pytest 公式推奨）+ editable install
  - `pythonpath` 設定は持たない。`uv sync --all-packages` の editable install が `apps/api/src` と `packages/core/src` を sys.path に載せるため、追加 path 設定は不要。
- async: pytest-asyncio (`auto` mode)
- **注意**: 各 `tests/` ディレクトリには **`__init__.py` を置かない**。`apps/api/tests` と `packages/core/tests` で package 名 `tests.test_*` が衝突するため。pytest は rootdir モードで自動コレクションする。

#### Sample test

```python
def test_health_check(client):
    response = client.get("/healthcheck")
    assert response.status_code == 200
    assert response.json() == {"message": "OK"}
```

## SQLModel Operations (MUST be Synchronous)

SQLModel の async サポートは公式に未提供（[issue #654](https://github.com/fastapi/sqlmodel/issues/654)）。Session 操作は **同期実装**で書き、FastAPI のエンドポイントだけを async にする。

```python
# ✅ Good: 同期 SQLModel
from sqlmodel import Session, select


class UserGateway:
    def get_by_id(self, session: Session, user_id: str) -> User | None:
        return session.exec(select(User).where(User.id == user_id)).first()


# Endpoint は async でも内部は同期 SQLModel で OK
@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    session: Session = Depends(get_session),
) -> UserResponse:
    return UserResponse.from_orm(UserGateway().get_by_id(session, user_id))
```

## Container / Deploy

### Railway (Production — apps/api)

Railpack（ゼロコンフィグビルダー）を使用。Dockerfile 不要。

> **重要**: Railway のサービス設定で **Root Directory を `backend-py`**（モノレポルート）に指定する。
> `apps/api/railway.toml` の `startCommand` は `uv run --package api uvicorn api.app:app …` で
> workspace 解決を前提としているため、`backend-py/apps/api/` ではなく **`backend-py/` をルート**にする必要がある。

```toml
# backend-py/apps/api/railway.toml
[build]
builder = "RAILPACK"

[deploy]
startCommand = "uv run --package api uvicorn api.app:app --host 0.0.0.0 --port ${PORT:-8000}"
```

#### railpack.json によるカスタマイズ

通常はゼロコンフィグで動作するため `railpack.json` は空（スキーマのみ）で問題ない。以下のケースで設定を追加する:

| ケース | 設定例 |
|--------|--------|
| システムパッケージが必要（libpq, ffmpeg 等） | `"buildAptPackages": ["libpq-dev"]`, `"deploy": { "aptPackages": ["libpq5"] }` |
| スタートコマンドのカスタマイズ（ワーカー数等） | `"deploy": { "startCommand": "..." }` |
| ビルドステップの追加（DB migration 等） | `"steps": { "build": { "commands": ["..."] } }` |
| ビルド時シークレットが必要 | `"secrets": ["DATABASE_URL"]` |
| ファイナルイメージの最小化 | `"steps": { "install": { "deployOutputs": ["/app/**"] } }` |

> 参考: https://railpack.com/config/file/

### devenv dockerTools (Other platforms — apps/api)

```bash
devenv container build backend
devenv container copy backend
```

## Environment Variables

`env/backend/.env.local` で管理する。

```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
# Optional: enable verbose SQLModel query echo (default off)
# SQL_ECHO=1
```

LLM などの追加サービスを使うときに、対応する API key 等を都度追加する。

## API Documentation

FastAPI が自動生成する:

- **Swagger UI**: http://localhost:4040/docs
- **ReDoc**: http://localhost:4040/redoc
- **OpenAPI Schema**: http://localhost:4040/openapi.json （`frontend/packages/api-client` の Hey API 生成元）

## MCP Server (apps/mcp)

実装はまだ無く、`apps/mcp/src/mcp_server/__init__.py` のみ存在する雛形。devenv の `backend-mcp` process は opt-in (`start.enable = false`) で登録されており、`devenv up backend-mcp` で placeholder メッセージを print するだけ。

実装着手時の手順は `apps/mcp/README.md` を参照。`mcp[cli]` SDK の `FastMCP` を使う想定。

## Troubleshooting

### Database Connection

```bash
echo $POSTGRES_URL

cd backend-py
uv run --package api python -c "from api.infra.db_client import engine; print(engine)"
```

### Type Check Failures

```bash
cd backend-py
uv run mypy apps packages --show-error-codes
```

### Import Errors

```bash
# workspace 全体を sync すれば editable install が再構築される
cd backend-py && uv sync --all-packages --all-groups

# import 検証（dev shell 内で）
uv run --package api python -c "import api.app, core.logging, core.supabase_client; print('OK')"
```

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [SQLModel Documentation](https://sqlmodel.tiangolo.com)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [MyPy Documentation](https://mypy.readthedocs.io)
- [pytest Documentation](https://docs.pytest.org)
- [uv Workspaces Documentation](https://docs.astral.sh/uv/concepts/projects/workspaces/)
- [Model Context Protocol (Python SDK)](https://github.com/modelcontextprotocol/python-sdk)

For project-specific guidelines, see `/CLAUDE.md` in the project root.
