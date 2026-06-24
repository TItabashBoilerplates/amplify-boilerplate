# Backend Python (FastAPI on AWS Lambda)

`backend-py/` は **uv workspace** で構成された Python モノレポ。FastAPI ベースの API サーバを最小スケルトンで、MCP サーバ用の雛形と共有パッケージ (`core`) も含む。

FastAPI は **AWS Lambda** 上で動作する（Amplify Gen2 の Python custom function が `backend-py` をパッケージして Lambda にデプロイ）。Lambda アダプタは **Mangum**、認可は **Cognito JWT 検証**。外部システムは **boto3**（DynamoDB / S3）または AppSync 経由でアクセスする。

## Workspace 構造

```
backend-py/
├── pyproject.toml          # workspace root（members 定義 + 共通 tooling）
├── uv.lock                 # 単一ルート lockfile（全 member の依存を解決）
├── .python-version         # 3.13
├── apps/
│   ├── api/                # FastAPI + Cognito JWT auth サーバ（Lambda 上）
│   └── mcp/                # MCP サーバ（FastMCP 最小実装・streamable-http）
└── packages/
    └── core/               # 全サービスで共有: logger / 共通例外 / Cognito auth utils
```

| Member | 役割 | 起動 |
|---|---|---|
| `apps/api` | FastAPI HTTP サーバ（Lambda / ローカル） | ローカルは uvicorn (port 4040)、本番は Lambda（Mangum） |
| `apps/mcp` | MCP サーバ（FastMCP） | `dev-mcp`（= `uv run --package mcp-server mcp-server`、streamable-http :4041） |
| `packages/core` | 共有ライブラリ | サービスから `from core.X import …` で import |

新しいサービスを追加するときは `apps/<name>/` を 1 つ生やし、`pyproject.toml` の `[tool.uv.workspace] members` に既にマッチ済みなので、`uv lock` を走らせるだけで workspace 化される。

## Overview (apps/api)

`apps/api` は **Clean Architecture** のレイヤー分離を前提に最小構成で立ち上がる:

- `GET /healthcheck` (auth 不要)
- Cognito JWT を検証する `verify_token` 依存（`api/middleware/auth_middleware.py`）
- structlog ベースの構造化ロギング（dev: 色付き / prod: JSON、`core.logging`）
- リクエストログ middleware（`api/middleware/logging_middleware.py`）
- 外部システムアクセスの初期化ヘルパ（boto3 クライアント等、`api/infra/`）
- 例外クラスのテンプレート（`api/domain/exceptions.py` + `core.exceptions`）

## Tech Stack

- **Framework**: FastAPI
- **Runtime**: AWS Lambda（Mangum アダプタ）。Amplify Python custom function がパッケージ・デプロイ
- **Architecture**: Clean Architecture (Controller / UseCase / Gateway / Domain / Infra / Middleware)
- **Auth**: Amazon Cognito（JWT 検証）
- **External systems**: boto3（DynamoDB / S3）/ AWS AppSync
- **Package Manager**: uv workspace（単一ルート venv + lockfile）
- **Code Quality**: Ruff (lint+format), MyPy (strict), pytest

## Directory Layout（apps/api）

```
backend-py/apps/api/src/api/
├── app.py                   # FastAPI エントリポイント（lifespan + exception handlers）
├── lambda_handler.py        # Mangum ハンドラ（Lambda エントリ: api.lambda_handler.handler）
├── main.py                  # uvicorn entrypoint（ローカル: `uv run --package api api`）
├── controller/
│   ├── __init__.py          # ルーター集約
│   └── base_controller.py   # 現状は GET /healthcheck のみ
├── usecase/                 # ビジネスロジック (空)
├── gateway/                 # データアクセス抽象 (空)
├── domain/
│   ├── entity/              # ドメインエンティティ (空 — 必要に応じて追加)
│   ├── service/             # ドメインサービス (空)
│   ├── const/error_messages.py
│   └── exceptions.py        # ResourceNotFoundError + core 例外の re-export
├── infra/                   # boto3 クライアント等のインフラ実装
└── middleware/
    ├── auth_middleware.py   # Cognito JWT 検証（Bearer token）
    └── logging_middleware.py
```

共有パッケージ:

```
backend-py/packages/core/src/core/
├── logging.py               # structlog 設定 (dev / prod 切替)
├── exceptions.py            # AuthenticationError / ConfigurationError
└── auth.py                  # Cognito JWT 検証ユーティリティ
```

`core` の責務は「複数サービスから参照される基盤」のみ。サービス固有のドメインロジック・エンティティは入れない。

## Layer Responsibilities

| Layer | 責務 |
|---|---|
| **Controller** | HTTP の入出力のみ。ビジネスロジックは持たない |
| **UseCase** | 複数 Gateway を協調させてビジネスフローを実装 |
| **Gateway** | データアクセスを抽象化（boto3 / AppSync + 外部 API 呼び出し） |
| **Domain** | Entity / Service / 例外 / 定数。外部依存を持たない |
| **Infrastructure** | boto3（DynamoDB / S3）/ AppSync / 外部サービスクライアント |
| **Middleware** | 認証（Cognito JWT）/ ロギング / CORS など横断的関心事 |
| **packages/core** | サービス間で共有する基盤 (logger, Cognito auth utils, 共通例外) |

DynamoDB / S3 へのアクセスは Gateway 経由で抽象化し、実体（boto3 クライアント）は `infra/` に置く。

## Cognito JWT 認証

リクエストの `Authorization: Bearer <token>` は `verify_token` Dependency で検証する。Cognito User Pool が発行した JWT を、`COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID`（Lambda 環境変数として Amplify の `backend.ts` が注入）を使って検証する。

```python
# apps/api/src/api/controller/users_controller.py
from typing import Annotated

from fastapi import APIRouter, Depends

from api.middleware.auth_middleware import verify_token

router = APIRouter()


@router.get("/me")
async def me(claims: Annotated[dict, Depends(verify_token)]) -> dict[str, str | None]:
    return {"sub": claims.get("sub"), "email": claims.get("email")}
```

その後 `api/controller/__init__.py` で `include_router(...)` する。

## AWS Lambda へのデプロイ

`apps/api` は Amplify Gen2 の **Python custom function** によって Lambda にパッケージ・デプロイされる。定義は frontend 側の `frontend/packages/backend/amplify/functions/api/resource.ts`:

- CDK `Function`（`Runtime.PYTHON_3_13`）
- ハンドラ: `api.lambda_handler.handler`（Mangum が ASGI の FastAPI を Lambda イベントに適合）
- バンドル: `uv export` でサードパーティ依存を `requirements.txt` に書き出し → pip で manylinux 互換 wheel をインストール → `apps/api/src/api` と `packages/core/src/core` をコピー
- 環境変数 `COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID` / `SNS_TOPIC_ARN` は `backend.ts` が配線

ローカル開発は uvicorn で直接起動できる（下記 Development 参照）。デプロイは `ampx sandbox`（per-dev）/ `ampx pipeline-deploy`（CI）が `backend-py` をバンドルする。

## Development

すべて devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`) を使用する。直接 `uv run X` の実行は禁止。

### Getting Started

```bash
# Setup
# `devenv shell` 進入 (direnv 経由含む) で setup:install-backend task が
# `cd backend-py && uv sync --all-packages --all-groups --frozen` を自動実行する。
# 明示的な init コマンドは不要。

# ローカルで FastAPI を起動（uvicorn）
dev-web                      # web と合わせて起動する場合
# または backend-py 単独の dev process（devenv up <backend-process>）
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

LLM / ベクトル検索 など重い依存は最初から積まない方針。必要になった時点で対応する member に `uv add` で導入する。データアクセスの既定は **Amplify Data（フロント `getDataClient()`）**、backend-py（FastAPI Lambda）は LLM / 長時間処理 / 複雑実装の escalation 先。

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

## External Systems (boto3 / AppSync)

DynamoDB / S3 などの AWS リソースには **boto3** でアクセスする。クライアントは `infra/` に置き、Gateway 経由で利用する。

```python
# apps/api/src/api/infra/dynamodb_client.py
import boto3

dynamodb = boto3.resource("dynamodb")


def get_table(name: str):
    return dynamodb.Table(name)
```

Lambda 実行ロールに必要な IAM 権限（DynamoDB / S3 / SNS publish 等）は Amplify の `backend.ts` で付与する（例: `notificationsTopic.grantPublish(fastapi)`）。

## Environment Variables

Lambda 上では Amplify の `backend.ts` が環境変数を注入する:

| 変数 | 用途 |
|---|---|
| `COGNITO_USER_POOL_ID` | Cognito JWT 検証 |
| `COGNITO_APP_CLIENT_ID` | Cognito JWT 検証（audience） |
| `SNS_TOPIC_ARN` | 通知（SNS publish） |

シークレットは **Amplify secrets（SSM Parameter Store）** で管理する（`ampx sandbox secret set NAME` / backend 定義から `secret('NAME')`）。LLM などの追加サービスの API key もここで管理する。

## API Documentation

FastAPI が自動生成する（ローカル uvicorn 起動時）:

- **Swagger UI**: http://localhost:4040/docs
- **ReDoc**: http://localhost:4040/redoc
- **OpenAPI Schema**: http://localhost:4040/openapi.json （`frontend/packages/api-client` の Hey API 生成元）

## MCP Server (apps/mcp)

`mcp[cli]` SDK の `FastMCP` ベースの最小実装。汎用ツール（`ping` / `add`）＋ AI 拡張ポイント
（`generate`、LangChain + Bedrock に差し替え前提）＋ resource（`config://info`）を公開する。
`dev-mcp` で streamable-http（:4041）起動。ツール追加・AI 連携・依存追加・MCP Inspector の手順は
`apps/mcp/README.md` を参照。

## AI / ML (LangChain / LangGraph)

LLM オーケストレーションは LangChain / LangGraph を FastAPI Lambda 上で動かす想定。長時間処理は Lambda のタイムアウト（既定 30s）に注意し、必要に応じて memory / timeout を `functions/api/resource.ts` で調整する。プロバイダは OpenAI / Anthropic 等。API key は Amplify secrets で管理する。

## Troubleshooting

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
uv run --package api python -c "import api.app, api.lambda_handler, core.logging, core.auth; print('OK')"
```

### Lambda バンドルの検証

```bash
# frontend 側の Amplify sandbox でバンドル込みデプロイを検証
sandbox-once     # = ampx sandbox --once（AWS 認証情報が必要）
```

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Mangum (ASGI adapter for Lambda)](https://mangum.io/)
- [AWS SDK for Python (boto3)](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- [Amplify Custom Functions](https://docs.amplify.aws/nextjs/build-a-backend/functions/custom-functions/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [MyPy Documentation](https://mypy.readthedocs.io)
- [pytest Documentation](https://docs.pytest.org)
- [uv Workspaces Documentation](https://docs.astral.sh/uv/concepts/projects/workspaces/)
- [Model Context Protocol (Python SDK)](https://github.com/modelcontextprotocol/python-sdk)

For project-specific guidelines, see `/CLAUDE.md` in the project root.
