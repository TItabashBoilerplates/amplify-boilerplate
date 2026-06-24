# api

FastAPI + Cognito JWT auth サーバ。`backend-py` モノレポの 1 メンバー。AWS Lambda 上で動作する（Mangum アダプタ。Amplify Python custom function がパッケージ・デプロイ）。

## 構造

```
apps/api/src/api/
├── app.py                # FastAPI application + lifespan + exception handlers
├── lambda_handler.py     # Mangum ハンドラ (Lambda entry: api.lambda_handler.handler)
├── main.py               # uvicorn entrypoint (ローカル: `uv run --package api api`)
├── controller/           # HTTP routing layer
├── usecase/              # Business logic
├── gateway/              # Data access abstraction (boto3 / AppSync)
├── domain/
│   ├── entity/           # Domain models
│   ├── service/          # Domain services
│   ├── const/            # Constants
│   └── exceptions.py     # ResourceNotFoundError + re-export core 例外
├── infra/                # boto3 クライアント等のインフラ実装
└── middleware/           # Logging + Auth (Cognito JWT) middleware
```

## 起動

### ローカル（uvicorn）

```bash
# 単独起動 (port 4040)
cd backend-py && uv run --package api uvicorn api.app:app --reload --port 4040

# 本番 entry (project.scripts)
cd backend-py && uv run --package api api
```

> 直接 `uv run` を叩くのは検証用途のみ。日常の起動・品質チェックは devenv の scripts を使う（`/.claude/rules/commands.md`）。

### Lambda（本番）

`api.lambda_handler.handler`（Mangum）がエントリ。Amplify の Python custom function
（`frontend/packages/backend/amplify/functions/api/resource.ts`）が `backend-py` を
パッケージして `Runtime.PYTHON_3_13` の Lambda にデプロイする。

## 認証（Cognito JWT）

`Authorization: Bearer <token>` を `verify_token` Dependency で検証する。Cognito User Pool が
発行した JWT を、Lambda 環境変数 `COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID`（Amplify の
`backend.ts` が注入）で検証する。

## 共有パッケージ

logger / Cognito auth utils / 共通例外は `packages/core/` 経由で利用する:

```python
from core.logging import get_logger
from core.auth import verify_cognito_jwt
from core.exceptions import AuthenticationError, ConfigurationError
```

API 固有のドメイン例外（`ResourceNotFoundError` 等）は `api/domain/exceptions.py` で定義する。

## 外部システム

DynamoDB / S3 などは **boto3** でアクセスする（クライアントは `infra/` に置き Gateway 経由で利用）。
Lambda 実行ロールへの IAM 権限付与は Amplify の `backend.ts` で行う。
