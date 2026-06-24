# Backend Python Guidelines

## Architecture

- Clean Architecture layers (apps/api 内)
- FastAPI on AWS Lambda（Mangum アダプタ。Amplify Python custom function がパッケージ・デプロイ）
- uv workspace モノレポ（`apps/{api,mcp}` + `packages/core`）

## Patterns

- Gateway pattern for DRY（外部システムは boto3 (DynamoDB / S3) / AppSync 経由）
- Type hints required
- 認可は Cognito JWT 検証（`api/middleware/auth_middleware.py`）
- 共有基盤 (logger / Cognito auth utils / 共通例外) は `packages/core` に集約
- サービス固有のドメイン (entity / 固有例外) は `apps/<service>/src/<service>/domain/`

## Formatting

- **Ruff format** for code formatting (replaces Black)
- **Ruff** for linting
- **MyPy** for type checking (strict mode)

設定は workspace root `backend-py/pyproject.toml` で一元管理。member 個別の設定は持たない。

## Commands

すべて devenv の **scripts** (PATH 直結) を使用する。直接 `uv run ruff` / `uv run mypy` / `uv run pytest` での実行は禁止。

```bash
lint-backend-py           # Ruff lint (workspace 全体, auto-fix)
format-backend-py         # Ruff format (workspace 全体, auto-fix)
type-check-backend-py     # MyPy (strict mode, workspace 全体)
test-backend-py           # pytest (workspace 全体)
```

正典: `/.claude/rules/commands.md`

## Lambda / Amplify

- Lambda ハンドラは `api.lambda_handler.handler`（Mangum）。
- Lambda 環境変数（`COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID` / `SNS_TOPIC_ARN`）は
  frontend 側 `frontend/packages/backend/amplify/backend.ts` が注入する。
- シークレットは Amplify secrets（SSM Parameter Store、`ampx sandbox secret set NAME`）で管理する。
- バンドル・デプロイは `ampx sandbox`（per-dev）/ `ampx pipeline-deploy`（CI）が `backend-py` を packaging する。
