# AGENTS.md

このファイルは OpenAI Codex がコードベースで作業する際のガイダンスを提供します。

## CRITICAL - 推測実装の完全禁止

- **推測・記憶・一般知識に基づく実装は一切禁止**
- 実装前に必ず公式ドキュメントを確認すること
- ライブラリの API、設定ファイル形式、CLI 構文は**必ずファクトを調査**してから使用
- 「たぶんこうだろう」「以前こうだった」という推測での実装は**絶対に行わない**
- **モジュール・パッケージは必ず最新バージョンを調査し、最新のAPIを使用すること**
- **ビルド・テスト・リント等は必ず devenv のコマンド（scripts または `devenv tasks run`）を使用すること**

> Makefile は **deprecated**。すべて devenv のコマンドへ移行済み。`make X` を叩くと案内メッセージのみ出力する。

## 会話言語

- 常に日本語で会話する

## Architecture Overview

Full-stack application boilerplate with multi-platform frontend and backend services.

### Tech Stack

| Layer                 | Technology                                       |
| --------------------- | ------------------------------------------------ |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, Bun            |
| **Frontend (Mobile)** | Expo 55, React Native, TypeScript                |
| **UI (Web)**          | shadcn/ui, Radix UI, TailwindCSS 4               |
| **UI (Mobile)**       | gluestack-ui, NativeWind 5, TailwindCSS 4        |
| **State**             | TanStack Query (server), Zustand (global)        |
| **Architecture**      | Feature Sliced Design (FSD)                      |
| **i18n**              | next-intl (en, ja)                               |
| **Backend**           | FastAPI (Python), Supabase Edge Functions (Deno) |
| **Database**          | PostgreSQL, Drizzle ORM, pgvector                |
| **Auth**              | Supabase Auth                                    |

### Package Management

| Component                                 | Package Manager |
| ----------------------------------------- | --------------- |
| Frontend Web (`frontend/apps/web/`)       | **Bun**         |
| Frontend Mobile (`frontend/apps/mobile/`) | **Bun**         |
| Backend Python (`backend-py/`)            | **uv**          |
| Drizzle (`drizzle/`)                      | **Bun**         |
| Edge Functions (`supabase/functions/`)    | **Deno**        |

---

## Core Policies (MANDATORY)

以下のポリシーは**必須**です。詳細は `.codex/skills/` の各ファイルを参照：

| ポリシー | 説明 |
|---------|------|
| **Research-First** | 実装前に公式ドキュメント確認必須 |
| **TDD** | テスト駆動開発、All Green必須 |
| **Commands** | devenv の scripts / `devenv tasks run` 使用必須 |
| **Auto-Generated** | 自動生成ファイル編集禁止 |
| **Supabase-First** | supabase-js優先、バックエンドは最終手段 |
| **i18n** | 多言語対応必須（en, ja） |
| **DateTime** | UTC保存、Frontend変換 |
| **Clean Code** | 後方互換禁止、重複禁止 |
| **UI Testing** | UI は Storybook、単体テスト不要 |
| **Debugging** | devenv 2.0 の native process manager TUI を主インターフェース |

### Debugging — devenv 2.0 native TUI（MANDATORY）

フロントエンド・バックエンドのデバッグは **devenv 2.0 の native process manager の TUI** を主インターフェースとして使用する。`devenv up` を対話端末で実行すると TUI が自動起動し、プロセス一覧・ログ閲覧・再起動がキーボード操作で可能。詳細は `.codex/skills/debugging/SKILL.md` を参照。

| 操作 | 方法 |
|---|---|
| 全プロセス死活確認 | `devenv up` を実行すると TUI でリスト表示、または `devenv processes wait` で ready 待機 |
| ログ取得 | TUI 内で対象プロセス選択 → ログ閲覧 |
| プロセス再起動 | TUI 内で対象プロセス選択 → 再起動 |
| 軽量セット起動 | `devenv up`（Supabase + backend + storybook） |
| 個別アプリ起動 | `dev-web`, `dev-mobile`, または `devenv up <name>` |
| 全停止 | `stop`（devenv プロセス + Supabase 両方） |

---

## Development Commands

すべて devenv shell（direnv 経由）で PATH 上に存在する **scripts** か、`devenv tasks run <name>` で起動する **tasks**。`make X` は使わない。

```bash
# Setup
# `devenv shell` 進入（direnv 経由含む）で setup:* タスクが自動実行:
#   - setup:install-frontend → bun install (frontend) ※ lockfile 変更検知時のみ
#   - setup:install-drizzle  → bun install (drizzle)
#   - setup:install-backend  → uv sync (backend-py/app)
# 明示的なブートストラップタスクは不要。

# Services
supabase-start                # Supabase (Docker) のみ起動
supabase-stop                 # Supabase (Docker) のみ停止
devenv up                     # 軽量セット: Supabase + backend + Storybook（TUI 付き）
dev-web                       # 軽量セット + Next.js (web)
dev-mobile                    # 軽量セット + Expo Metro (mobile, non-interactive)
dev-all                       # 軽量セット + 全 frontendApps
devenv up backend web         # 任意組み合わせ
stop                          # devenv プロセス + Supabase をすべて停止

# Quality
lint                          # 全プロジェクトの lint (auto-fix)
format                        # 全プロジェクトの format (auto-fix)
format-check                  # 各 sub-project の format-check
type-check                    # 各 sub-project の type-check
ci-check                      # = `devenv test`、ci:check aggregator 経由（キャッシュ込み）
devenv test                   # ci-check と同等。ローカル/CI で同じコマンド

# Tests
test                          # 全 unit test (frontend + backend-py)
test-frontend                 # Vitest
test-backend-py               # pytest
test-db                       # pgTAP DB tests
e2e / e2e-web / e2e-mobile    # Maestro E2E

# Database
# ローカルは AI 自動実行可、本番 / staging (`db:migrate-deploy`) はユーザー承認必須。詳細は .codex/skills/drizzle/SKILL.md
devenv tasks run app:migrate-dev   # ローカル: Generate + apply migration + type 生成（フルフロー、AI 実行可）
devenv tasks run db:migrate-dev    # ローカル: マイグレーション生成 + 適用のみ（AI 実行可）
devenv tasks run model:build       # 型のみ再生成（AI 実行可）
devenv tasks run -P production db:migrate-deploy   # 本番: ⚠️ ユーザー承認必須
```

---

## Environment Configuration

```
env/
├── README.md                  # 構成・方針（canonical）
├── backend/.env.local         # Backend 非機密 config
├── frontend/.env.local        # Frontend (Next.js) 非機密 config
├── migration/.env.local       # Database migration 非機密 config
└── .env.secrets               # 旧シークレット (.gitignore・非ロード・doppler-import 用)
```

> シークレットは **Doppler 管理**（`$ENV` 駆動・ファイルフォールバック廃止）。詳細は
> `env/README.md` / `.claude/skills/doppler/SKILL.md`。

---

## Supabase Configuration

| Setting                | Location                       |
| ---------------------- | ------------------------------ |
| Auth (OAuth, JWT, MFA) | `supabase/config.toml`         |
| Storage buckets        | `supabase/config.toml`         |
| API settings           | `supabase/config.toml`         |
| Tables                 | `drizzle/schema/`              |
| RLS policies           | `drizzle/schema/`              |
| Realtime               | `drizzle/config/post-migration/` |
| Migrations             | `drizzle/migrations/` (drizzle-kit 出力) |

> **マイグレーションは Drizzle に集約**: 出力先は `drizzle/migrations/`（v3 フォルダ形式）。`supabase/migrations/` は使用しない。

---

## Domain Documentation

| ドメイン          | ドキュメント                                                       |
| ----------------- | ------------------------------------------------------------------ |
| Frontend (Web)    | [`frontend/README.md`](frontend/README.md)                         |
| Frontend (Mobile) | [`frontend/apps/mobile/README.md`](frontend/apps/mobile/README.md) |
| Database Schema   | [`drizzle/README.md`](drizzle/README.md)                           |
| Backend Python    | [`backend-py/README.md`](backend-py/README.md)                     |
| Edge Functions    | [`supabase/functions/README.md`](supabase/functions/README.md)     |

---

## AI/ML Features

- **Vector Search**: pgvector
- **LLM Orchestration**: LangChain/LangGraph
- **Providers**: OpenAI, Anthropic, Replicate, FAL
- **Real-time**: LiveKit

→ 詳細は [`backend-py/README.md`](backend-py/README.md)

---

## Skills Reference

質問時に参照するガイダンス：

| スキル | 説明 |
|-------|------|
| `fsd/` | Feature Sliced Design |
| `monorepo/` | Bun workspace 構成 |
| `tanstack-query/` | TanStack Query v5 |
| `supabase/` | Supabase 認証・RLS |
| `drizzle/` | Drizzle ORM スキーマ |
| `datetime/` | 日時処理 |
| `shadcn-ui/` | shadcn/ui + TailwindCSS (Web) |
| `gluestack/` | gluestack-ui + NativeWind (Mobile) |
| `storybook/` | Storybook コンポーネントカタログ |
| `pgtap/` | RLS・DB 関数テスト（pgTAP + `supabase test db`） |
| `python-testing/` | Python単体テスト |
| `i18n/` | next-intl 多言語対応 |
| `langchain/` | LangChain/LangGraph/LangSmith |
| `maestro/` | Maestro E2Eテスト |
| `debugging/` | デバッグ手順（devenv 2.0 native CLI 優先・Supabase） |
