# CRITICAL: Development Command Guidelines

**CRITICAL / NON-NEGOTIABLE**: Always use **devenv** commands (scripts on PATH or `devenv tasks run <name>`) for development. Direct execution of underlying tools (bun/uv/biome/ruff/tsc/deno/supabase) is **strictly prohibited**.

**Makefile は deprecated**。`make X` は使わない。誤って叩いた場合は案内メッセージのみが出る。

**特に品質チェック（lint, format, type-check, test, build, ci-check）は例外なく devenv のコマンドを使うこと。**

## devenv コマンドの種類

| 種類 | 使い方 | 例 |
|---|---|---|
| **Scripts** (PATH 直結) | コマンド名を直接打つ | `lint`, `format`, `type-check`, `ci-check`, `dev-web`, `dev-mobile`, `dev-all`, `frontend`, `mobile-ios`, `lint-frontend`, `format-backend-py`, `supabase-start`, `stop`, `drizzle-studio` |
| **Tasks** (依存グラフ・pipeline) | `devenv tasks run <namespace:name>` | `devenv tasks run db:migrate-dev`, `devenv tasks run model:build`, `devenv tasks run deploy:functions` |
| **Processes** (常駐サービス) | `devenv up [PROCESSES...]` | `devenv up` (軽量セット), `devenv up web`, `devenv up backend web` |

scripts は devenv shell（direnv 自動アクティベート含む）下で PATH 上に存在する。direnv 未活性のセッションでは `devenv shell -- <command>` 経由で呼び出す。

## Required Commands（品質チェック）

**ALWAYS use** these scripts for the following operations:

| Operation | Command |
|-----------|---------|
| **Linting (all)** | `lint` |
| **Linting (per project)** | `lint-frontend`, `lint-drizzle`, `lint-backend-py`, `lint-functions`, `lint-fsd` |
| **Linting (CI mode)** | `lint-frontend-ci`, `lint-drizzle-ci`, `lint-backend-py-ci`（通常は `ci-check` から呼ばれる） |
| **Formatting (all)** | `format` |
| **Formatting (per project)** | `format-frontend`, `format-drizzle`, `format-backend-py`, `format-functions` |
| **Format check (CI)** | `format-check`（個別: `format-frontend-check`, `format-drizzle-check`, `format-backend-py-check`, `format-functions-check`） |
| **Type check (all)** | `type-check` |
| **Type check (per project)** | `type-check-frontend`, `type-check-mobile`, `type-check-backend-py`, `check-functions` |
| **Build** | `build-frontend`, `build-storybook`, `build-mobile-ios`, `build-mobile-android` |
| **Tests (unit)** | `test` (all), `test-frontend` (Vitest), `test-backend-py` (pytest) |
| **Tests (DB / E2E)** | `test-db` (pgTAP), `e2e`, `e2e-web`, `e2e-mobile` |
| **CI Check (full gate)** | `ci-check` (= `devenv test`、execIfModified キャッシュで incremental) |
| **CI Check (直叩き)** | `devenv test` (`ci:check` aggregator task が `before = devenv:enterTest`) |
| **Services (軽量)** | `devenv up` (= Supabase + backend + storybook), `stop` (停止), `supabase-start` / `supabase-stop` |
| **Services (frontend apps)** | `dev-web`, `dev-mobile`, `dev-all`, または `devenv up <names...>` |
| **Services (devenv 外)** | `frontend` (turbo dev), `mobile-ios`, `mobile-android`, `mobile-web` (Expo TUI) |

## Required Tasks（pipeline / 依存付き）

| Operation | Command |
|---|---|
| **DB migration (full pipeline)** | `devenv tasks run app:migrate-dev` |
| **DB migration (生成 + 適用のみ)** | `devenv tasks run db:migrate-dev` |
| **DB migration (deploy)** | `devenv tasks run db:migrate-deploy` |
| **Type/Model 生成** | `devenv tasks run model:build` (= model:frontend + model:functions) |
| **Seed (DB + Storage)** | `devenv tasks run seed:all` |
| **Deploy Edge Functions** | `devenv tasks run deploy:functions` |
| **Deploy Supabase 全体** | `devenv tasks run deploy:supabase` |
| **Polar.sh プラン同期** | `devenv tasks run polar:sync-dry` / `polar:sync` |
| **初回ブートストラップ** | 不要（`devenv shell` / `direnv reload` で `setup:*` が自動セットアップ） |

## Database Migration Policy

**ローカル DB のマイグレーションは AI 実行可。本番デプロイは引き続きユーザー承認必須。**

| 操作 | 対象 | AI 自動実行 |
|---|---|---|
| `devenv tasks run app:migrate-dev` | ローカル | ✅ 可 |
| `devenv tasks run db:migrate-dev` | ローカル | ✅ 可 |
| `devenv tasks run model:*` | (型生成のみ) | ✅ 可 |
| `devenv tasks run -P staging db:migrate-deploy` | staging (共有) | ❌ 要承認 |
| `devenv tasks run -P production db:migrate-deploy` | 本番 | ❌ 要承認 |
| `drizzle/migrations/` 内ファイルの手動編集 | (生成済み migration) | ❌ 禁止 (ハッシュ整合性破壊) |

**Local Workflow**:

```bash
# 1. スキーマ編集
vi drizzle/schema/schema.ts

# 2. AI が自動実行可
devenv tasks run app:migrate-dev

# 3. 生成 SQL を確認
ls drizzle/migrations/
cat drizzle/migrations/<latest>/migration.sql

# 4. 失敗時は schema/post-migration を直して再実行 (or supabase-stop && supabase-start で reset)
```

**Remote Workflow (ユーザー承認必須)**:

```bash
# AI は実行禁止。ユーザーに「staging/production に流してよいか」を必ず確認してから:
devenv tasks run -P staging db:migrate-deploy
devenv tasks run -P production db:migrate-deploy
```

**Why local can be auto-executed**:
- ローカル Supabase は Docker で再起動可能、データ損失は個人開発環境に限定
- スキーマ変更 → 型再生成 → テストの流れを止めずに進められる

**Why remote still requires approval**:
- 共有システム / 本番ユーザーへの影響、データ損失は不可逆
- 適用タイミング (メンテナンス枠) への配慮が必要

## Prohibited Direct Commands（品質チェック）

以下のような直接実行は**絶対に禁止**。必ず devenv の scripts / tasks を使うこと：

```bash
# ❌ 絶対に直接実行しない
cd frontend && bun run biome check --write
cd frontend && bun run biome format --write
cd frontend && bun run tsc --noEmit
cd frontend && bun run vitest
cd backend-py && uv run ruff check
cd backend-py && uv run ruff format
cd backend-py && uv run mypy
cd backend-py && uv run pytest
cd drizzle && bun run biome check
npx tsc --noEmit

# ❌ Makefile は削除済み — `make X` は `make: *** No targets. Stop.` でエラー終了する
make lint
make ci-check
make migrate-dev

# ✅ 必ず devenv scripts または tasks を使用
lint                              # 全体 lint
lint-frontend                     # Frontend lint
lint-backend-py                   # Backend lint
format                            # 全体 format
format-frontend                   # Frontend format
format-backend-py                 # Backend format
type-check                        # 全体型チェック
type-check-frontend               # Frontend 型チェック
type-check-backend-py             # Backend 型チェック
ci-check                          # CI チェック (lint + format + type)
devenv tasks run app:migrate-dev  # マイグレーション (フルフロー)
devenv tasks run model:build      # モデル/型再生成
```

## Exceptions

Direct command execution is allowed ONLY for:
- **Reading files**: `cat`, `less`, `head`, `tail` (prefer Read tool)
- **Listing files**: `ls`, `find`, `tree` (prefer Glob tool)
- **Git operations**: `git status`, `git diff`, `git log` (read-only)
- **Package info**: `bun list`, `npm list`, `uv pip list` (read-only)

## 品質チェック設計（2 段階構成）

公式 devenv の推奨パターンに従い、品質チェックは **役割を分けた 2 段階構成**:

### 段階 1: コミット時の差分チェック (git-hooks)

`.pre-commit-config.yaml` は `git-hooks.nix` ビルトインを使う:

| Hook | 対象 |
|---|---|
| `biome` | JS/TS/JSON (lint + format、auto-fix、`pass_filenames=true` で変更ファイルのみ) |
| `ruff` | Python lint (`pass_filenames=true`) |
| `ruff-format` | Python format |
| `mypy` | Python type check |
| `denofmt` | Edge Functions format (supabase/functions/ 配下) |
| `denolint` | Edge Functions lint |

`prek` (Rust 実装) が pre-commit を駆動。**コミット 1 回 < 200ms** が普通。

### 段階 2: CI / 手動 verify (devenv test)

`devenv test` を叩くと `ci:check` aggregator task が起動し、配下の verify task が並列・キャッシュ実行される:

```
devenv test
└── ci:check (before = [devenv:enterTest])
    ├── lint-ci:frontend / drizzle / backend-py / functions / fsd  (execIfModified)
    ├── format-check:frontend / drizzle / backend-py / functions    (execIfModified)
    └── type-check:frontend / mobile / backend-py / functions       (execIfModified)
```

- `execIfModified` で **mtime + content hash** チェック → 変更なしならスキップ
- キャッシュ: `.devenv/` 配下、`devenv-tasks` Rust binary が管理
- 何も変更してなければ全 task キャッシュヒット → 数秒で完了
- **ローカル**: `devenv test` (= ci:check aggregator) を主に使う
- **CI** (`.github/workflows/ci.yml`): Supabase Docker / Storybook 起動を避けるため、`devenv test` ではなく verify task (`lint-ci:* / format-check:* / type-check:*`) を直接列挙して呼ぶ

> **使い分け**: 日常の auto-fix は `lint` / `format` script (シンプル sequential、execIfModified なし → 副作用ループ回避)。CI 相当の verify はローカルでは `ci-check` または `devenv test`、CI では verify task の直接列挙。

## Enforcement

This command usage policy is **CRITICAL and NON-NEGOTIABLE**.

品質チェックを直接コマンドで実行することは、以下の問題を引き起こす：
- 環境依存の差異による不整合
- CI/CD パイプラインとの乖離
- 意図しない副作用（設定差異によるフォーマット崩れ等）
- profile (env) 設定が読み込まれず、本番設定で local 開発するリスク

**違反は一切許容しない。**
