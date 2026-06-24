# Development Commands

すべて devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`) を使用する。Makefile は **deprecated**（削除済み）。直接 `bun run` / `uv run` / `cd frontend && ...` 等での実行は禁止。

正典: `/.claude/rules/commands.md`

## Initial Setup

`devenv shell` 進入 (direnv 経由含む) で `setup:*` task が自動実行され、依存・secrets が同期される。明示的な init コマンドは不要。

## Running Services

```bash
devenv up                       # 軽量セット起動 (Supabase + backend + storybook、TUI 付き)
dev-web                         # 軽量セット + Next.js (web)
dev-mobile                      # 軽量セット + Expo Metro (mobile, non-interactive)
dev-all                         # 軽量セット + 全 frontend apps
devenv up backend web           # 任意組み合わせ
stop                            # devenv プロセス + Supabase Docker 全停止
supabase-start / supabase-stop  # Supabase Docker 単独制御
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

# Drizzle (Biome)
lint-drizzle            # Biome lint (auto-fix)
lint-drizzle-ci         # Biome lint (CI mode, no fixes)
format-drizzle          # Biome format (auto-fix)
format-drizzle-check    # Biome format check (check only)

# Backend Python (Ruff + MyPy)
lint-backend-py         # Ruff lint (auto-fix)
lint-backend-py-ci      # Ruff lint (CI mode, no fixes)
format-backend-py       # Ruff format (auto-fix)
format-backend-py-check # Ruff format check (check only)
type-check-backend-py   # MyPy type checking (strict mode)

# Edge Functions (Deno)
lint-functions          # Deno lint
format-functions        # Deno format (auto-fix)
format-functions-check  # Deno format check (check only)
check-functions         # Deno type checking (auto-detect all functions)

# FSD Boundary Check
lint-fsd                # FSD boundary check (web + mobile, ESLint)

# Integrated Commands (Recommended)
lint                    # Lint all (Frontend + Drizzle + Backend Python + Edge Functions)
format                  # Format all (auto-fix)
format-check            # Format check all (CI mode)
type-check              # Type check all
ci-check                # All CI checks (= devenv test、ローカル用 ci:check aggregator)
```

## Database Operations

ローカルマイグレーションは AI 自動実行可、本番 / staging は **ユーザー承認必須**。

```bash
# Development Migration (local) — AI 実行可
devenv tasks run app:migrate-dev    # Generate + apply migration + 型生成（フルフロー、推奨）
devenv tasks run db:migrate-dev     # マイグレーション生成 + 適用のみ

# Production Migration Apply — ユーザー承認必須
devenv tasks run -P staging    db:migrate-deploy
devenv tasks run -P production db:migrate-deploy

# Type Generation (usually included in migrate-dev)
devenv tasks run model:build        # Generate Supabase types + Drizzle schema (frontend + functions)
```

## Model Generation

```bash
devenv tasks run model:frontend     # Frontend: Supabase types + Hey API client + Drizzle schema copy
devenv tasks run model:functions    # Edge Functions: Supabase types + Drizzle schema copy
devenv tasks run model:build        # All models (= model:frontend + model:functions)
```

**Generated for Edge Functions**:

- `supabase/functions/shared/types/supabase/schema.ts` - Supabase TypeScript types
- `supabase/functions/shared/drizzle/` - Drizzle schema (TypeScript)

## Test

```bash
test                # 全 unit test (frontend + backend-py)
test-frontend       # Vitest
test-backend-py     # pytest
test-db             # pgTAP DB tests
e2e / e2e-web / e2e-mobile  # Maestro E2E
```

## Build / Deploy

```bash
build-frontend       # Next.js production build
build-storybook      # Storybook static build

devenv tasks run -P staging    deploy:functions   # Edge Functions (staging)
devenv tasks run -P production deploy:functions   # Edge Functions (production)
devenv tasks run -P production deploy:supabase    # config + buckets + functions + secrets フルデプロイ
```

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

Code quality tools:

- Ruff for linting (line length: 88)
- MyPy for type checking (strict mode)
- Maximum function complexity: 3 (McCabe)

## Edge Functions Development

Edge Functions use Deno's native `Deno.serve` API for serverless API development:

- Built with Deno runtime for TypeScript support
- Native `Deno.serve` API for lightweight, efficient serverless functions
- Each function should have a `deno.json` with import map configuration
- **IMPORTANT**: Use `npm:` prefix for npm package imports by default
  - Do not use JSR (`jsr:`) unless there's a specific reason
  - Example: `"@supabase/supabase-js": "npm:@supabase/supabase-js@^2"`
- Type-safe integration with Supabase client and database schema
- Proper error handling with TypeScript type guards (`error instanceof Error`)

### Using Drizzle Schema in Edge Functions

You can use Drizzle schema directly in Edge Functions:

```typescript
// supabase/functions/example/index.ts
import type { InferSelectModel, InferInsertModel } from "npm:drizzle-orm";
import { generalUsers, generalUserProfiles } from "../shared/drizzle/index.ts";

// Infer types
type User = InferSelectModel<typeof generalUsers>;
type NewUser = InferInsertModel<typeof generalUsers>;
type UserProfile = InferSelectModel<typeof generalUserProfiles>;

Deno.serve(async (req) => {
  const user: User = {
    id: crypto.randomUUID(),
    displayName: "John Doe",
    accountName: "johndoe",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return new Response(JSON.stringify({ user }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Benefits**:

- TypeScript type safety
- Types auto-update when schema changes (when running `devenv tasks run model:build`)
- Can use both Supabase-generated types and Drizzle types

**→ For detailed Edge Functions documentation, see [`supabase/functions/README.md`](../../supabase/functions/README.md)**
