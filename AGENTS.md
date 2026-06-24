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
| **Backend** | FastAPI (Python), Supabase Edge Functions (Deno) |
| **Database** | PostgreSQL, Drizzle ORM, pgvector |
| **Auth** | Supabase Auth |

## Commands (MANDATORY)

**ALWAYS use devenv commands** (scripts on PATH or `devenv tasks run`) for development. Direct tool execution is prohibited. Makefile はもう存在しません。

```bash
# Setup
# 不要 — `devenv shell` 進入 (direnv 経由含む) で setup:* タスクが自動実行:
#   - secrets コピー / bun install (frontend, drizzle) / uv sync (backend-py)

# Services（軽量 default = supabase + backend + storybook）
devenv up              # 軽量セット起動 (TUI 付き)
dev-web                # 軽量 + Next.js (web)
dev-mobile             # 軽量 + Expo Metro (mobile, non-interactive)
dev-all                # 全部入り
devenv up backend web  # 任意組み合わせ
stop                   # devenv プロセス + Supabase 全停止

# Devenv 外（対話的 TUI 必要時）
frontend               # turbo dev (web + mobile 並列、重い)
mobile-ios / mobile-android / mobile-web   # Expo TUI を別ターミナルで

# Quality
lint                   # Lint all (auto-fix)
format                 # Format all
format-check           # Format check (CI)
type-check             # Type check all
ci-check               # CI gate (lint + format-check + type-check)

# Tests
test-db                # pgTAP DB tests
e2e / e2e-web / e2e-mobile

# Database (user approval required)
devenv tasks run app:migrate-dev   # Generate + apply migration + types (recommended)
devenv tasks run db:migrate-dev    # Migration only
devenv tasks run model:build       # Regenerate types only

# Profile switching for remote ops
devenv tasks run -P staging db:migrate-deploy
devenv tasks run -P production deploy:functions
```

**NEVER execute tools directly**:

```bash
# WRONG
cd frontend && bun run biome check --write
npx tsc --noEmit
make lint           # ❌ Makefile は削除済み

# CORRECT
lint-frontend
type-check-frontend
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

### 3. Supabase-First Architecture

**Priority order**:
1. **First**: `supabase-js` / `@supabase/ssr` from frontend
2. **Second**: Edge Functions (if necessary)
3. **Last Resort**: `backend-py` (only when required)

**Use backend-py ONLY for**:
- Complex database transactions
- AI/ML processing (LangChain, embeddings)
- Long-running background jobs
- Python-specific library requirements

### 4. Auto-Generated Files (DO NOT EDIT)

**NEVER manually edit**:
- `frontend/packages/types/schema.ts`
- `supabase/functions/shared/types/supabase/schema.ts`
- `backend-py/apps/api/src/api/domain/entity/models.py`

**Correct workflow**: Edit `drizzle/schema/*.ts` → run `devenv tasks run app:migrate-dev`

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
| **Database** | UTC | `TIMESTAMP WITH TIME ZONE` |
| **API** | UTC | ISO 8601 string |
| **Frontend** | Convert UTC ⇔ Local | `toISOString()` / `Intl.DateTimeFormat` |

**Frontend is responsible for all timezone conversions**.

### 7. Storage Policy

**Default: Private buckets** (unless explicitly requested otherwise)

```typescript
// CORRECT: Use createSignedUrl for private files
const { data } = await supabase.storage
  .from('documents')
  .createSignedUrl('path/to/file.pdf', 60)

// WRONG: getPublicUrl on private bucket
const { data } = supabase.storage
  .from('documents')
  .getPublicUrl('path/to/file.pdf')
```

**RESTful path structure**: `{resource}/{id}/{sub-resource}/{filename}`

---

## Domain Documentation

| Domain | Documentation |
|--------|---------------|
| Frontend (Web) | [frontend/README.md](frontend/README.md) |
| Frontend (Mobile) | [frontend/apps/mobile/README.md](frontend/apps/mobile/README.md) |
| Backend Python | [backend-py/README.md](backend-py/README.md) |
| Database Schema | [drizzle/README.md](drizzle/README.md) |
| Edge Functions | [supabase/functions/README.md](supabase/functions/README.md) |

---

## Package Management

| Component | Package Manager |
|-----------|-----------------|
| Frontend Web | **Bun** |
| Frontend Mobile | **Bun** |
| Backend Python | **uv** |
| Drizzle | **Bun** |
| Edge Functions | **Deno** |

---

## Debugging (MANDATORY)

フロントエンド・バックエンドのデバッグは **devenv 2.0 の native process manager の TUI** を主インターフェースとして使用する。`devenv up` を対話端末で実行すると TUI が自動起動し、プロセス状態・リアルタイムログ・個別再起動がキーボード操作で可能。process-compose は撤去済み。

非対話環境（CI / Claude Code）では `/tmp/devenv-*/processes/logs/<process>.{stdout,stderr}.log` を直接 tail する:

```bash
tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log
tail -100 /tmp/devenv-*/processes/logs/storybook.stderr.log
tail -100 /tmp/devenv-*/processes/logs/web.stderr.log     # devenv up web 起動時
```

詳細は `.claude/skills/debugging/SKILL.md` を参照。

---

## Skills

Detailed guidance available in `.codex/skills/`:

- `fsd/` - Feature Sliced Design
- `drizzle/` - Drizzle ORM schema management
- `supabase/` - Supabase Auth, RLS, Storage
- `tanstack-query/` - TanStack Query v5
- `datetime/` - DateTime handling patterns
- `i18n/` - next-intl internationalization
- `shadcn-ui/` - shadcn/ui + TailwindCSS
- `debugging/` - デバッグ手順（devenv 2.0 native process manager の TUI 優先）
