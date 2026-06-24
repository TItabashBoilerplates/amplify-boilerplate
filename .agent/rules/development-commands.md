# Development Commands

すべて devenv の **scripts** (PATH 直結) または `devenv up [PROCESSES...]` を使用する。Makefile は **deprecated**（削除済み）。直接 `bun run` / `uv run` / `bunx ampx` / `cd frontend && ...` 等での実行は禁止。

正典: `/.claude/rules/commands.md`

## Initial Setup

`bootstrap` で依存をインストールする（frontend: bun / backend-py: uv）。`devenv shell` 進入 (direnv 経由含む) で `setup:*` task が自動実行され、依存が同期される場合もある。

```bash
bootstrap                       # 依存インストール（frontend + backend-py）
```

## Amplify Backend (sandbox)

データモデル・認可・ストレージ・関数の変更は `frontend/packages/backend/amplify/` を編集し、
`ampx sandbox` で per-dev のクラウド sandbox に反映する（Supabase ローカル Docker の代替）。

```bash
sandbox                         # ampx sandbox（watch + amplify_outputs.json 生成）
sandbox-once                    # 1 回デプロイして終了
sandbox-delete                  # sandbox 破棄
```

> ⚠️ `sandbox` / デプロイには AWS 認証情報（プロファイル）が必要。

## Running Services

```bash
dev-web                         # Next.js (web)
dev-mobile                      # Expo Metro (mobile)
storybook                       # Storybook
devenv up [PROCESSES...]        # 任意の常駐サービス組み合わせ
```

## Lint & Format

すべて devenv の **scripts** (PATH 直結):

```bash
# Frontend (Biome)
lint-frontend           # Biome lint (auto-fix)
lint-frontend-ci        # Biome lint (CI mode, no fixes)
format-frontend         # Biome format (auto-fix)
format-frontend-check   # Biome format check (check only)
type-check-frontend     # TypeScript type checking

# Backend Python (Ruff + MyPy)
lint-backend-py         # Ruff lint (auto-fix)
lint-backend-py-ci      # Ruff lint (CI mode, no fixes)
format-backend-py       # Ruff format (auto-fix)
format-backend-py-check # Ruff format check (check only)
type-check-backend-py   # MyPy type checking (strict mode)

# FSD Boundary Check
lint-fsd                # FSD boundary check (web + mobile, ESLint)

# Integrated Commands (Recommended)
lint                    # Lint all (Frontend + Backend Python)
format                  # Format all (auto-fix)
format-check            # Format check all (CI mode)
type-check              # Type check all
ci-check                # All CI checks (= devenv test、ローカル用 ci:check aggregator)
```

## Amplify Data / Schema Operations

Amplify Data のスキーマ・認可ルールはコードファースト。`frontend/packages/backend/amplify/data/resource.ts`
を `a.schema(...)` / `a.model(...)` で編集し、`sandbox`（`ampx sandbox`）が watch して AppSync + DynamoDB
へ反映する。`Schema` 型と GraphQL クライアントは sandbox の deploy 時に自動生成される（手動の型生成タスクは不要）。

```typescript
// frontend/packages/backend/amplify/data/resource.ts
const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
})
```

フロントからの利用:

```typescript
import type { Schema } from '@workspace/backend'
import { getDataClient } from '@workspace/data-client'

const { data: todos } = await getDataClient().models.Todo.list()
```

## Test

```bash
unit-test           # 全 unit test (frontend + backend-py)
test-frontend       # Vitest
test-backend-py     # pytest
e2e / e2e-web / e2e-mobile  # Maestro E2E
```

## Build / Deploy

```bash
build-frontend       # Next.js production build
build-storybook      # Storybook static build
```

ブランチ / 本番デプロイは **AWS Amplify Hosting** が `amplify.yml`（monorepo, appRoot=frontend）に従い
`ampx pipeline-deploy` と Next.js build を実行する（CI）。手動の deploy script は不要。

## Frontend Development (Editor / 個別パッケージ追加)

```bash
# 依存追加 (devenv shell 内で ni / nr / nlx 経由)
ni package           # = bun add package
ni -D package        # = bun add -d package
nr <script>          # = bun run <script> (package.json scripts 経由)
nlx <command>        # = bunx <command>
```

## Backend Development (Python)

Backend follows clean architecture with strict separation of concerns:

- Controllers handle HTTP requests/responses only
- Use cases contain business logic
- Gateways provide data access interfaces
- Infrastructure handles external dependencies

`backend-py` は uv workspace（`apps/api` = FastAPI, `apps/mcp`, `packages/core` = logger / exceptions / auth utils）。
FastAPI は AWS Lambda 上に Mangum ハンドラ (`api.lambda_handler.handler`) で載り、Amplify の Python custom
function (`frontend/packages/backend/amplify/functions/api/resource.ts`, CDK Function PYTHON_3_13) として
デプロイされる。認証は Cognito JWT 検証ミドルウェア
(`backend-py/.../middleware/auth_middleware.py`)。

Code quality tools:

- Ruff for linting (line length: 88)
- MyPy for type checking (strict mode)
- Maximum function complexity: 3 (McCabe)

**→ For detailed Python backend documentation, see [`backend-py/README.md`](../../backend-py/README.md)**
