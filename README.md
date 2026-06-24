# shadcn-boilerplate

## Description

This is a full-stack application boilerplate with a multi-platform frontend and backend services:

- **Frontend (Web)**: Next.js 16, React 19, shadcn/ui, TailwindCSS 4, Bun
- **Frontend (Mobile)**: Expo 55, React Native 0.82, gluestack-ui, NativeWind 5
- **Backend**: FastAPI (Python) with Supabase Edge Functions (Deno)
- **Database**: PostgreSQL with Drizzle ORM for schema management and pgvector extension

## Tech Stack

| Layer                 | Technology                                       |
| --------------------- | ------------------------------------------------ |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, Bun            |
| **Frontend (Mobile)** | Expo 55, React Native 0.82, TypeScript           |
| **UI (Web)**          | shadcn/ui, MagicUI, Radix UI, TailwindCSS 4      |
| **UI (Mobile)**       | gluestack-ui, NativeWind 5, TailwindCSS 4        |
| **State**             | TanStack Query v5 (server), Zustand (global)     |
| **Architecture**      | Feature Sliced Design (FSD)                      |
| **i18n**              | next-intl (en, ja)                               |
| **Backend**           | FastAPI (Python), Supabase Edge Functions (Deno) |
| **Database**          | PostgreSQL, Drizzle ORM, pgvector                |
| **Auth**              | Supabase Auth                                    |

## Project Structure Highlights

### Monorepo Configuration

This project uses an **independent monorepo structure without a root package.json**:

- **`drizzle/`**: Database schema management (independent package, Bun)
- **`frontend/`**: Next.js 16 + Expo monorepo (Bun workspace, Turbo build system)
- **`backend-py/`**: Python FastAPI (uv, independent)

Each directory has its own dependencies and node_modules/, cleanly separated.

### Package Managers

Using optimal package managers for each component (バージョンは devenv が管理):

- **Frontend**: Bun (fast, Node.js compatible)
- **Backend Python**: uv (Rust-based, fast dependency management)
- **Drizzle**: Bun (same as frontend)
- **Edge Functions**: Deno (built-in package manager)

### ni Commands (Package Manager Abstraction)

このプロジェクトでは [ni](https://github.com/antfu-collective/ni) を使用してパッケージマネージャーを抽象化しています。内部では Bun が使用されますが、コマンドは `ni`/`nr`/`nlx` を使用してください。

| ni              | Bun equivalent       | 説明                           |
| --------------- | -------------------- | ------------------------------ |
| `ni`            | `bun install`        | 依存関係をインストール         |
| `ni package`    | `bun add package`    | パッケージを追加               |
| `ni -D package` | `bun add -d package` | 開発依存として追加             |
| `nr script`     | `bun run script`     | package.json のスクリプト実行  |
| `nlx command`   | `bunx command`       | パッケージを一時的に実行       |

### Frontend Packages

The frontend monorepo (`frontend/packages/`) contains the following shared packages:

| Package | Description |
|---------|-------------|
| `@workspace/ui-web` | shadcn/ui + MagicUI components for web |
| `@workspace/ui-mobile` | gluestack-ui components for mobile |
| `@workspace/types` | Supabase types (auto-generated) |
| `@workspace/api-client` | Backend API client (Hey API + TanStack Query) |
| `@workspace/auth` | Authentication utilities |
| `@workspace/tokens` | Design tokens (colors, spacing) |
| `@workspace/query` | TanStack Query configuration |
| `@workspace/client` | Supabase client (@supabase/ssr) |
| `@workspace/logger` | Logging (Pino) |
| `@workspace/onesignal` | OneSignal push notifications |
| `@workspace/utils` | Utility functions |

### Unified Code Quality

Unified code quality management across all projects:

- **Frontend & Drizzle**: Biome (fast ESLint + Prettier alternative)
- **Backend Python**: Ruff (lint) + MyPy (type check)
- **Edge Functions**: Deno native tools
- **Unified Commands**: `lint`, `format`, `ci-check` (devenv scripts on PATH)

## Development Environment

For this project, we recommend the following development setup:

- Frontend: Utilize Visual Studio Code's workspace feature
- Backend: Use Visual Studio Code's devcontainer functionality

By adopting these environments, we can ensure efficient development and maintain consistency across the team.

## Architecture

### Frontend Architecture

- **Web Application**: Next.js 16 with App Router and Turbopack for development
- **Mobile Application**: Expo 55 with React Native 0.82 and Expo Router
- **Architecture**: Feature-Sliced Design (FSD) methodology with strict layer organization
- **UI Framework (Web)**: shadcn/ui + MagicUI components built on Radix UI with TailwindCSS 4
- **UI Framework (Mobile)**: gluestack-ui components with NativeWind 5 (TailwindCSS for React Native)
- **Tech Stack**: React 19, TypeScript, Bun package manager
- **Build System**: Turbo for monorepo management

### Backend Architecture

- **Python Backend**: FastAPI application in `backend-py/` using clean architecture patterns
- **Edge Functions**: Supabase Edge Functions using Deno's native `Deno.serve` API for lightweight serverless functions
- **Database**: PostgreSQL with **Drizzle ORM** for schema management, includes pgvector extension for embeddings
- **Infrastructure**: Supabase for auth/database (Docker, managed by Supabase CLI), FastAPI managed via devenv 2.0 native process manager (TUI)

#### Configuration Management

- **Supabase Services** (`supabase/config.toml`): Auth, Storage, API settings, service-level configurations
- **Database Schema** (`drizzle/`): Tables, RLS policies, Realtime publications, functions, triggers managed with Drizzle ORM

### Key Features

- Multi-client architecture with corporate users, general users, and virtual users
- Chat system with rooms, messages, and user relationships
- Vector embeddings for AI/ML features
- Clean separation between user types and permissions

## Requirements

- [Docker Desktop](https://www.docker.com/) (Supabase ローカル環境用)
- [devenv](https://devenv.sh/getting-started/) (Nix ベースの開発環境)
- [direnv](https://direnv.net/) + シェルフック設定

> Make は **不要**。日常コマンドはすべて devenv の **scripts** (PATH 直結) と **tasks** (`devenv tasks run <name>`) で提供される。Makefile は deprecated。

### devenv が提供するツール

以下のツールは devenv が自動で管理するため、個別インストールは不要です:

| ツール | 用途 |
|--------|------|
| Node.js 22 | Frontend, Drizzle |
| Python 3.13 | Backend |
| Deno | Edge Functions |
| Bun | Frontend パッケージ管理 |
| uv | Python パッケージ管理 |
| Supabase CLI | データベース・認証 |
| ni / nr / nlx | パッケージマネージャー抽象化 |
| Maestro | E2E テスト |

> 環境変数は devenv の **profiles** で管理する。**local が既定**（`-P` 指定なしで base enterShell が `env/<service>/.env.local` + `env/.env.secrets` をロードする）。`-P dev` / `-P staging` / `-P production` を付けると後勝ちで env を上書きする。dotenvx は不要。env ファイル (`env/<service>/.env.<profile>`) は `.env.local` 以外 gitignore 対象。配置されていなくても profile アクティベーション自体はエラーにならず（`[ -f ] && . ` ガードのため）、後で env ファイルを置けば即読み込まれる。

## Setup

### 1. devenv + direnv のインストール

```bash
# Nix をインストール (未インストールの場合)
curl -sSfL https://install.determinate.systems/nix | sh -s -- install

# devenv をインストール（どちらか一方）
nix-env --install --attr devenv -f https://github.com/NixOS/nixpkgs/tarball/nixpkgs-unstable
# または
nix profile install nixpkgs#devenv

# direnv をインストール
brew install direnv
```

シェルフックを `~/.zshrc` に追加:

```bash
eval "$(direnv hook zsh)"
```

設定を反映:

```bash
source ~/.zshrc
```

### 2. Nix バイナリキャッシュの設定 (推奨)

ビルド済みパッケージをダウンロードできるようにするため、trusted-users を設定します。
未設定でも動作しますが、初回の `devenv shell` が大幅に遅くなります。

```bash
sudo sh -c 'echo "trusted-users = root $(whoami)" >> /etc/nix/nix.conf'
sudo launchctl kickstart -k system/org.nixos.nix-daemon
```

### 3. 開発環境のアクティベート（初回のみ `direnv allow` が必要）

direnv はセキュリティ上の理由から、初回のみ手動で `.envrc` を信頼することを宣言する必要があります:

```bash
cd shadcn-boilerplate
direnv allow
```

これ以降は `cd` するだけで自動的に devenv 環境がアクティベートされます:

```bash
cd shadcn-boilerplate
# direnv: loading .envrc
# direnv: using devenv
# ✓ Building shell in 250ms
# devenv: Node, Python, Deno, Bun, uv が PATH 上に揃う（バージョンは devenv.lock に固定）
```

- 初回のみ Nix ビルドが走るため数分かかります。2回目以降は数百ミリ秒です
- ディレクトリを離れると自動的にディアクティベートされます（`exit` は不要）
- `.envrc` の内容が変わった場合のみ、再度 `direnv allow` が必要になります

> **Note**: direnv を使わない場合は `devenv shell` で手動アクティベートできます。

### 4. プロジェクトの初期化

**初回のみ**、対話セットアップを実行します:

```bash
init   # Doppler login + setup（シークレット管理）等の初回セットアップ（対話）
```

`devenv shell` に入っただけで以下は **自動実行** される（`setup:*` task / `before = [ "devenv:enterShell" ]` + `execIfModified`）:

- Doppler 紐付け（`setup:doppler` → `doppler setup --no-interactive`。ログイン済みなら project/config を idempotent に紐付け）
- Frontend / Drizzle 依存関係のインストール（`bun install --frozen-lockfile`）
- Backend Python 依存関係のインストール（`uv sync --frozen --group dev`）

> 依存・Doppler 紐付けの**非対話**部分は setup:* task が自動同期する。`doppler login`（ブラウザ認証）のような**対話**部分は `init` コマンドで一度だけ行う（`doppler.yaml` の `<doppler-project>` を実プロジェクト名に置換してから）。詳細は `env/README.md` / `.claude/skills/doppler/SKILL.md`。Docker (Supabase ローカル用) は外部依存なので `docker info` で動作確認しておくこと。

### 5. 環境変数の設定

環境変数はコンポーネント別に `env/` ディレクトリで管理しています:

```
env/
├── README.md                  # env/ の構成・方針（詳細はこちら）
├── backend/.env.local         # Backend 非機密 config (Supabase URL 等)
├── frontend/.env.local        # Frontend 非機密 config (Next.js)
├── migration/.env.local       # Database migration 非機密 config (DATABASE_URL)
└── .env.secrets               # 旧シークレット (.gitignore・読み込まれない・doppler-import 用)
```

**シークレットは Doppler 管理**（ファイルフォールバックは廃止）。`env/<service>/.env.<ENV>` には
**非機密 config のみ**を置く。読み込みは環境変数 `ENV`（既定 `local`）駆動で、`env/<service>/.env.$ENV`
を source し、シークレットは Doppler の対応 config から注入する（未接続なら警告）。詳細は
[`env/README.md`](env/README.md) と `.claude/skills/doppler/SKILL.md`。`-P <profile>` は対応する `ENV`
を export する。env ファイルは `.env.local` 以外すべて gitignore 対象。

### 6. データベースセットアップ

```bash
devenv tasks run app:migrate-dev   # マイグレーション生成 + 適用 + 型生成（フルフロー）
```

## Execution

After successfully completing the setup, you can start the application using one of the following commands:

### Light default — `devenv up`

`devenv up` (profile 指定なし = local 既定) は **軽量セット** を起動します:

- Supabase (Docker, `supabase:start` task が backend の `before` で自動先行)
- backend (FastAPI, port 4040)
- storybook (port 6006)

```bash
devenv up   # 軽量セット (TUI 付き)
stop        # 全停止 (devenv processes + Supabase Docker)
```

TUI で各プロセスのリアルタイムログ・個別再起動が可能。Ctrl+C で TUI を終了したあと、Supabase Docker を完全に停止するには `stop` を別ターミナルで実行する。

> Supabase は devenv 管理外（独立した Docker コンテナ群）。手動制御が必要なときは `supabase-start` / `supabase-stop` script を使う。

### モノレポのフロントエンドアプリ起動 (opt-in)

`frontend/apps/<name>` 配下の各アプリは **opt-in process** として登録されており (`start.enable = false`)、`devenv up` 単体では起動しません。明示指定または preset script を使います:

| 起動内容 | コマンド |
|---|---|
| 軽量セット (backend + storybook のみ) | `devenv up` |
| 軽量セット + Next.js (web) | `dev-web`（= `devenv up backend storybook web`） |
| 軽量セット + Expo Metro (mobile, non-interactive) | `dev-mobile` |
| 全部入り (web + mobile も含む) | `dev-all` |
| アプリ単独 (例: web のみ) | `devenv up web` |
| 任意組み合わせ | `devenv up backend web` など |

> Expo の対話的 TUI（`r` でリロード、QR コード等）は devenv process では使えません。対話操作したい場合は別ターミナルで `mobile` / `mobile-ios` / `mobile-android` / `mobile-web` script を叩いてください (devenv 外で Expo TUI を直接起動)。

### `frontend/apps/` への新規アプリ追加

`devenv.nix` の `frontendApps` attrset に **1 行追加** するだけで以下が自動連動します:

- `processes.<name>` (start.enable=false で opt-in process 化)
- `scripts.dev-<name>` (= `devenv up backend storybook <name>`)
- `scripts.dev-all` の起動対象に自動追加

```nix
# devenv.nix の let block 内
frontendApps = {
  web   = { port = 3000; };
  admin = { port = 3001; };          # ← admin アプリ追加例
  mobile = {
    port = 8081;
    ready = "/status";
    exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nr start'';
  };
};
```

| key | 必須 | 既定 | 用途 |
|---|---|---|---|
| `port` | ✅ | — | ready probe で叩くポート |
| `ready` | — | `"/"` | ready probe path |
| `exec` | — | `cd frontend/apps/<name> && exec nr dev` | 起動コマンドを完全カスタマイズしたい場合のみ |

事前に `frontend/apps/<name>/package.json` に `dev` (Next.js 系) または `start` (Expo 系) script が定義されていることが前提。

### モノレポ全アプリの一括起動 (turbo dev、devenv 外)

```bash
frontend       # `cd frontend && turbo dev` (web + mobile を並列起動、重い)
```

`dev-all` は backend + storybook + 各アプリを **devenv の TUI で個別管理**。`frontend` script は **devenv 外で turbo dev** を 1 プロセスとして起動。用途で使い分け。

### Frontend Development (Mobile)

Expo の対話的 TUI が必要な場合は別ターミナルで:

```bash
mobile          # 対話的にプラットフォーム選択
mobile-ios      # iOS シミュレータ
mobile-android  # Android エミュレータ
mobile-web      # Web 版
```

## Additional Commands

> 全コマンドは devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`)。Makefile は **deprecated**。

### Code Quality Management

This project implements unified code quality management across all components (Frontend, Drizzle, Backend Python, Edge Functions).

#### Unified Commands (Recommended)

```bash
lint           # Lint all projects (auto-fix)
format         # Format all projects (auto-fix)
format-check   # Format check all projects (CI, no fix)
type-check     # Type check all projects
ci-check       # CI gate (lint + format-check + type-check)
```

#### Frontend Specific (Biome)

```bash
lint-frontend           # Biome lint (auto-fix)
lint-frontend-ci        # Biome lint (CI, no fix)
format-frontend         # Biome format (auto-fix)
format-frontend-check   # Biome format check
type-check-frontend     # TypeScript type check
lint-fsd                # FSD boundary check (web + mobile)
```

#### Drizzle Specific (Biome)

```bash
lint-drizzle            # Biome lint (auto-fix)
lint-drizzle-ci         # Biome lint (CI, no fix)
format-drizzle          # Biome format (auto-fix)
format-drizzle-check    # Biome format check
```

#### Backend Python Specific (Ruff + MyPy)

```bash
lint-backend-py         # Ruff lint (auto-fix)
lint-backend-py-ci      # Ruff lint (CI, no fix)
format-backend-py       # Ruff format (auto-fix)
format-backend-py-check # Ruff format check
type-check-backend-py   # MyPy type check (strict mode)
```

#### Edge Functions Specific (Deno)

```bash
lint-functions          # Deno lint
format-functions        # Deno format (auto-fix)
format-functions-check  # Deno format check
check-functions         # Deno type check (all functions auto-detected)
```

### Development Tools

- Check Supabase status:

  ```bash
  check
  ```

- Build frontend:

  ```bash
  build-frontend
  ```

- Build storybook:

  ```bash
  build-storybook
  ```

### Database Operations

This project manages database schema with Drizzle ORM.

**Development (Local)**:

```bash
# Generate + Apply migration + Generate types (recommended)
devenv tasks run app:migrate-dev

# Generate + Apply migration only (no type generation)
devenv tasks run db:migrate-dev

# Push schema directly to DB (for prototyping)
drizzle-push

# Start Drizzle Studio (GUI)
drizzle-studio

# Validate schema
drizzle-validate
```

**Production (Remote)**:

```bash
# Staging environment
devenv tasks run -P staging db:migrate-deploy

# Production environment
devenv tasks run -P production db:migrate-deploy
```

**Command Usage**:

- `app:migrate-dev`: For local development. Schema changes → Generate migration → Apply → Generate types in one go
- `db:migrate-deploy`: For remote environments. Only apply existing migration files
- `drizzle-push`: Push schema directly without generating migration files (for experimentation/prototyping)

For details, see the "Drizzle Schema Management" section in `CLAUDE.md`.

### Model Generation

```bash
# Frontend Supabase types + Hey API client
devenv tasks run model:frontend

# Edge Functions Supabase types + Drizzle schema copy
devenv tasks run model:functions

# All models (frontend + functions, ordered)
devenv tasks run model:build
```

### Edge Functions

```bash
# Deploy all Edge Functions to remote project
devenv tasks run -P production deploy:functions
```

### Deployment (Remote)

Deploy Supabase resources to remote environments (staging/production):

```bash
# 1. Supabase platform settings (Config, Buckets, Functions, Secrets)
devenv tasks run -P staging deploy:supabase

# 2. DB migration
devenv tasks run -P staging db:migrate-deploy
```

**What `deploy:supabase` applies**:
- Config (Auth settings, API settings) - `supabase config push`
- Storage Buckets - `supabase seed buckets`
- Edge Functions (all functions) - `supabase functions deploy`
- Secrets - `supabase secrets set`

For details, see `.claude/skills/supabase/deploy.md`.

# Development Guidelines

## Code Quality

- **Frontend**: Biome for linting and formatting (all-in-one toolchain, replaces ESLint + Prettier), TypeScript strict mode
- **Backend**: Ruff for linting (line length: 88), MyPy for type checking
- **Edge Functions**: Deno native tools, `npm:` prefix for dependencies (not JSR or HTTP imports)
- **UI Design (Web)**: shadcn/ui + MagicUI components (Radix UI) with TailwindCSS 4 and CSS variables
- **UI Design (Mobile)**: gluestack-ui components with NativeWind 5
- **Package Manager**: [ni](https://github.com/antfu-collective/ni) (abstraction layer using Bun internally)
- **Build System**: Turbo for efficient monorepo builds

## Architecture Patterns

- **Frontend**: Feature-Sliced Design (FSD) with strict layer hierarchy (app → pages → widgets → features → entities → shared)
- **Backend**: Clean architecture with Controllers, Use Cases, Gateways, and Infrastructure
- **Database**: Multi-client architecture with proper separation of concerns

## Integrated Tools

The project includes integrations for:

- **[Next.js 16](https://nextjs.org/)**: React framework with App Router and Turbopack
- **[Expo 55](https://expo.dev/)**: React Native development platform
- **[shadcn/ui](https://ui.shadcn.com/)**: UI component library built on Radix UI (Web)
- **[MagicUI](https://magicui.design/)**: Animated UI components (Web)
- **[gluestack-ui](https://gluestack.io/)**: UI component library (Mobile)
- **[NativeWind 5](https://www.nativewind.dev/)**: TailwindCSS for React Native
- **[TailwindCSS 4](https://tailwindcss.com/)**: Utility-first CSS framework
- **[TanStack Query v5](https://tanstack.com/query)**: Server state management
- **[Zustand](https://zustand-demo.pmnd.rs/)**: Global state management
- **[next-intl](https://next-intl-docs.vercel.app/)**: Internationalization (en, ja)
- **[Supabase](https://supabase.com/)**: Authentication, database, and Edge Functions
- **[Drizzle ORM](https://orm.drizzle.team/)**: TypeScript ORM with declarative schema management
- **[FastAPI](https://fastapi.tiangolo.com/)**: Python backend framework
- **[Bun](https://bun.sh/)**: Fast package manager and JavaScript runtime
- **[Turbo](https://turbo.build/)**: High-performance build system for monorepos
- **[Docker](https://docker.com/)**: Used for Supabase local environment
- **[devenv](https://devenv.sh/)**: Nix-based development environment with process management (replaces Docker for backend/frontend services)
- **[OneSignal](https://onesignal.com/)**: Push notification service

### AI Coding Assistants

This project is optimized for major AI coding assistants:

- **[Claude Code](https://claude.com/claude-code)**: Provides detailed guidelines via `CLAUDE.md`
- **[Cursor](https://cursor.com/)**: Defines project-specific rules via `.cursorrules` file
- **[OpenAI Codex](https://openai.com/codex)**: Auto-detects `AGENTS.md`, uses `gpt-5-codex` model
  - Setup guide: `docs/codex-setup.md`
  - Config example: `.codex/config.toml.example`
- **GitHub Copilot**: Provides project context via `AGENTS.md`

Each AI assistant automatically understands the project's architecture, coding conventions, and best practices.

## Future Considerations

The following tools are being considered for implementation:

- **[Resend](https://resend.com/)**: Email delivery service
- **[Sentry](https://sentry.io/)**: Application monitoring and error tracking
- **[Stripe](https://stripe.com/)**: Payment processing platform
- **[RevenueCat](https://www.revenuecat.com/)**: Subscription management for mobile apps
