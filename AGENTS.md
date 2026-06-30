# Project Guidelines

Full-stack application boilerplate with multi-platform frontend and backend services.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend (Web)** | Next.js 16, React 19, TypeScript, Bun |
| **Frontend (Mobile)** | Expo 55, React Native, TypeScript |
| **UI (Web)** | shadcn/ui, Radix UI, TailwindCSS 4 |
| **UI (Mobile)** | gluestack-ui, NativeWind 5, TailwindCSS 4 |
| **State** | TanStack Query (server), Zustand (global) |
| **Architecture** | Feature Sliced Design (FSD) |
| **i18n** | next-intl (en, ja) |
| **Auth** | Amazon Cognito (Amplify Auth, passwordless Email OTP) |
| **Data** | AWS AppSync + DynamoDB (Amplify Data, `a.schema`) |
| **Storage** | Amazon S3 (Amplify Storage) |
| **Backend (compute)** | FastAPI on AWS Lambda (Amplify Python custom function, Mangum) |
| **Notifications** | Amazon SNS (Pinpoint for mobile push: follow-up) |
| **Secrets** | Amplify secrets (SSM Parameter Store) |
| **Hosting / CI-CD** | AWS Amplify Hosting (`amplify.yml`) |

## Commands (MANDATORY)

**ALWAYS use devenv commands** (scripts on PATH or `devenv tasks run`) for development. Direct tool execution is prohibited. Makefile はもう存在しません。

```bash
# Setup
bootstrap              # 依存インストール (frontend: bun / backend-py: uv)
#   ※ `devenv shell` 進入 (direnv 経由含む) で setup:* タスクが自動実行される

# Amplify backend（Supabase ローカル Docker の代替）
sandbox                # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成、watch）
sandbox-once           # 1 回デプロイして終了
sandbox-delete         # sandbox 破棄
#   ⚠️ sandbox / デプロイには AWS 認証情報（プロファイル）が必要

# Dev servers
dev-web                # Next.js (web)
dev-mobile             # Expo Metro (mobile, non-interactive)
storybook              # Storybook
devenv up <names...>   # 任意組み合わせ
stop                   # devenv プロセス停止

# Devenv 外（対話的 TUI 必要時）
frontend               # turbo dev (web + mobile 並列、重い)
mobile-ios / mobile-android / mobile-web   # Expo TUI を別ターミナルで

# Quality
lint                   # Lint all (auto-fix)
format                 # Format all
type-check-frontend / type-check-backend-py
ci-check               # CI gate (lint + format-check + type-check)

# Tests
unit-test              # 全 unit test (frontend Vitest + backend-py pytest)
e2e / e2e-web / e2e-mobile   # Maestro

# Deploy（CI）
#   Amplify Hosting が amplify.yml に従い ampx pipeline-deploy + Next.js build を実行
```

**NEVER execute tools directly**:

```bash
# WRONG
cd frontend && pnpm run biome check --write
cd frontend/packages/backend && pnpm dlx ampx sandbox
npx tsc --noEmit
make lint           # ❌ Makefile は削除済み

# CORRECT
lint-frontend
type-check-frontend
sandbox
```

---

## Core Policies (NON-NEGOTIABLE)

### 1. Research-First Development

**Before implementation, you MUST**:

1. Use **Context7 MCP** to fetch latest documentation
2. Use **WebSearch** to verify current best practices
3. Use **WebFetch** to read official documentation directly

**NEVER**:
- Make assumptions based on memory or general knowledge
- Use outdated patterns without verification
- Guess API signatures or parameter types

### 2. Test-Driven Development (TDD)

**MANDATORY workflow**:

1. **Write Tests First**: Define expected inputs/outputs before implementation
2. **Run Tests and Confirm Failure**: Verify tests fail (Red phase)
3. **Implement to Pass Tests**: Write minimal code (Green phase)
4. **Refactor if Needed**: Keep tests green

**All Green Policy**: Work MUST end with all tests passing (`ci-check` に加えて関連テストを実行)。

**NEVER**:
- Write implementation code before tests
- Modify tests to make them pass
- Leave failing tests at end of work

### 3. Amplify-First Architecture

**Priority order**:
1. **First**: Amplify Data from the frontend — `getDataClient()` (`@workspace/data-client`) で AppSync/DynamoDB に直接アクセス（CRUD・認可は `a.schema` の `allow.*` に集約）
2. **Second**: Amplify Auth / Storage を直接（`aws-amplify/auth`, S3 path-based）
3. **Last Resort**: `backend-py` (FastAPI on Lambda) — 必要なときのみ

**Use backend-py ONLY for**:
- 複雑なオーケストレーション / 複数リソースをまたぐ処理
- AI/ML processing (LangChain, embeddings)
- Long-running background jobs
- Python-specific library requirements

### 4. Backend Definition Files (where to edit)

**Amplify バックエンドの変更は `frontend/packages/backend/amplify/` を編集**:
- `amplify/data/resource.ts` — データモデル + 認可（`a.schema` / `allow.*`）
- `amplify/auth/resource.ts` — Cognito（Email OTP）
- `amplify/storage/resource.ts` — S3（path-based）
- `amplify/functions/api/resource.ts` — FastAPI Python Lambda
- `amplify/backend.ts` — `defineBackend({ auth, data, storage, api })` + SNS 配線

**Correct workflow**: 上記を編集 → `sandbox` (= `ampx sandbox`) で per-dev クラウド sandbox に反映。
フロントは `import type { Schema } from '@workspace/backend'` で型を共有する（手書きの型生成は不要）。

### 5. Internationalization (i18n)

**ALL user-facing text MUST be internationalized**:

```typescript
// WRONG
<Button>Save</Button>

// CORRECT
<Button>{t('common.save')}</Button>
```

Both `en.json` and `ja.json` are required.

### 6. DateTime Handling

| Layer | Timezone | Format |
|-------|----------|--------|
| **Database (DynamoDB)** | UTC | ISO 8601 string (`AWSDateTime` / `a.datetime()`) |
| **API** | UTC | ISO 8601 string |
| **Frontend** | Convert UTC ⇔ Local | `toISOString()` / `Intl.DateTimeFormat` |

**Frontend is responsible for all timezone conversions**.

### 7. Storage Policy

**Default: Private, path-based access** (Amplify Storage / S3, unless explicitly requested otherwise)

```typescript
// CORRECT: download/upload via aws-amplify/storage with private paths
import { getUrl, uploadData } from 'aws-amplify/storage'

const { url } = await getUrl({
  path: ({ identityId }) => `private/${identityId}/documents/file.pdf`,
  options: { expiresIn: 60 },
})

// WRONG: exposing private paths publicly / hardcoding another user's identityId
```

**Path structure**: `private/{identityId}/{resource}/{filename}`（アクセス制御は `defineStorage` の access ルールで宣言）

---

## Domain Documentation

| Domain | Documentation |
|--------|---------------|
| Frontend (Web) | [frontend/README.md](frontend/README.md) |
| Frontend (Mobile) | [frontend/apps/mobile/README.md](frontend/apps/mobile/README.md) |
| Backend Python | [backend-py/README.md](backend-py/README.md) |
| Amplify Backend (auth/data/storage/functions) | [frontend/packages/backend/README.md](frontend/packages/backend/README.md) |

---

## Package Management

| Component | Package Manager |
|-----------|-----------------|
| Frontend Web | **Bun** |
| Frontend Mobile | **Bun** |
| Amplify backend (`packages/backend`) | **Bun** (`ampx`) |
| Backend Python | **uv** |

---

## Debugging (MANDATORY)

フロントエンド・バックエンドのデバッグは **devenv 2.0 の native process manager の TUI** を主インターフェースとして使用する。`devenv up` を対話端末で実行すると TUI が自動起動し、プロセス状態・リアルタイムログ・個別再起動がキーボード操作で可能。process-compose は撤去済み。

非対話環境（CI / Claude Code）では `/tmp/devenv-*/processes/logs/<process>.{stdout,stderr}.log` を直接 tail する:

```bash
tail -100 /tmp/devenv-*/processes/logs/storybook.stderr.log
tail -100 /tmp/devenv-*/processes/logs/web.stderr.log     # devenv up web 起動時
```

Amplify バックエンドのデバッグは `sandbox` (= `ampx sandbox`) のコンソール出力、生成された
`amplify_outputs.json`、および Lambda/AppSync の CloudWatch Logs を確認する。AWS 認証情報
（プロファイル）が未設定だと sandbox は起動しない。詳細は `.claude/skills/debugging/SKILL.md` を参照。

---

## Skills

Detailed guidance available in `.codex/skills/`:

- `fsd/` - Feature Sliced Design
- `monorepo/` - Bun workspace + FSD monorepo structure
- `tanstack-query/` - TanStack Query v5
- `datetime/` - DateTime handling patterns
- `i18n/` - next-intl internationalization
- `shadcn-ui/` - shadcn/ui + TailwindCSS
- `maestro/` - Maestro E2E (Cognito Email OTP)
- `debugging/` - デバッグ手順（devenv TUI + ampx sandbox）
