# amplify-boilerplate

AWS Amplify Gen2 ベースのフルスタック・ボイラープレート（FSD + モノレポ）。
インフラはすべて AWS（Cognito / AppSync+DynamoDB / S3 / Lambda / SNS / Amplify Hosting）。

## Description

This is a full-stack application boilerplate with a multi-platform frontend and AWS-native backend:

- **Frontend (Web)**: Next.js 16, React 19, shadcn/ui, TailwindCSS 4, Bun
- **Frontend (Mobile)**: Expo 55, React Native 0.82, gluestack-ui, NativeWind 5
- **Backend**: AWS Amplify Gen2 — Cognito (auth), AppSync + DynamoDB (data), S3 (storage),
  FastAPI on Lambda (Python custom function), SNS (notifications)
- **Hosting**: AWS Amplify Hosting (CI/CD, branch previews)

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
| **Auth**              | Amazon Cognito (Amplify Auth, Email OTP)         |
| **Data**              | AWS AppSync + DynamoDB (Amplify Data)            |
| **Storage**           | Amazon S3 (Amplify Storage)                      |
| **Backend (compute)** | FastAPI on AWS Lambda (Amplify custom function, Python) |
| **Notifications**     | Amazon SNS (Pinpoint for mobile push: follow-up) |
| **Secrets**           | Amplify secrets (SSM Parameter Store)            |
| **Hosting / CI-CD**   | AWS Amplify Hosting (`amplify.yml`)              |
| **Payments**          | Polar (外部 SaaS、維持)                          |

## Project Structure Highlights

### Monorepo Configuration

This project uses an **independent monorepo structure without a root package.json**:

- **`frontend/`**: Next.js 16 + Expo monorepo (Bun workspace, Turbo build system)
  - **`packages/backend/`**: Amplify Gen2 backend (`amplify/`: auth/data/storage/functions)
- **`backend-py/`**: Python FastAPI (uv) — packaged onto Lambda by the Amplify custom function

Each directory has its own dependencies and node_modules/, cleanly separated.

### Package Managers

Using optimal package managers for each component (バージョンは devenv が管理):

- **Frontend**: Bun (fast, Node.js compatible)
- **Backend Python**: uv (Rust-based, fast dependency management)
- **Amplify CLI**: `ampx` (`@aws-amplify/backend-cli`)

### ni Commands (Package Manager Abstraction)

このプロジェクトでは [ni](https://github.com/antfu-collective/ni) を使用してパッケージマネージャーを抽象化しています。内部では Bun が使用されますが、コマンドは `ni`/`nr`/`nlx` を使用してください。

| ni              | Bun equivalent       | 説明                           |
| --------------- | -------------------- | ------------------------------ |
| `ni`            | `pnpm install`        | 依存関係をインストール         |
| `ni package`    | `pnpm add package`    | パッケージを追加               |
| `ni -D package` | `pnpm add -d package` | 開発依存として追加             |
| `nr script`     | `pnpm run script`     | package.json のスクリプト実行  |
| `nlx command`   | `pnpm dlx command`       | パッケージを一時的に実行       |

### Frontend Packages

The frontend monorepo (`frontend/packages/`) contains the following shared packages:

| Package | Description |
|---------|-------------|
| `@workspace/ui-web` | shadcn/ui + MagicUI components for web |
| `@workspace/ui-mobile` | gluestack-ui components for mobile |
| `@workspace/backend` | Amplify Gen2 backend (auth/data/storage/functions) + `Schema` type |
| `@workspace/data-client` | Amplify Data client (`getDataClient()` / `generateClient<Schema>()`) |
| `@workspace/auth` | Authentication utilities (Cognito, AuthProvider/useAuthUser) |
| `@workspace/api-client` | FastAPI (Lambda) client (TanStack Query) |
| `@workspace/tokens` | Design tokens (colors, spacing) |
| `@workspace/query` | TanStack Query configuration |
| `@workspace/logger` | Logging (Pino) |
| `@workspace/utils` | Utility functions |

### Unified Code Quality

Unified code quality management across all projects:

- **Frontend & Amplify backend**: Biome (fast ESLint + Prettier alternative)
- **Backend Python**: Ruff (lint) + MyPy (type check)
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

### Backend Architecture (AWS Amplify Gen2)

The backend is defined code-first in the shared workspace package `@workspace/backend`
(`frontend/packages/backend/amplify/`):

- **Auth**: Amazon Cognito (Amplify Auth, passwordless Email OTP) — `amplify/auth/resource.ts`
- **Data**: AWS AppSync + DynamoDB (Amplify Data) — `amplify/data/resource.ts` via `a.schema(...)`,
  authorization rules (`allow.owner()` / `allow.authenticated()` / `allow.guest()`) replace RLS
- **Storage**: Amazon S3 (Amplify Storage, `defineStorage`, private path-based) — `amplify/storage/resource.ts`
- **Compute**: FastAPI on AWS Lambda (Amplify Python custom function, Mangum handler
  `api.lambda_handler.handler`) — `amplify/functions/api/resource.ts`; the `backend-py/` clean-architecture
  app is packaged onto the Lambda. Auth = Cognito JWT verification middleware.
- **Notifications**: Amazon SNS, wired in `amplify/backend.ts` (Pinpoint for mobile push is a follow-up)
- **Wiring**: `amplify/backend.ts` = `defineBackend({ auth, data, storage, api })` + SNS configuration

#### Configuration Management

- **Backend definition** (`frontend/packages/backend/amplify/*`): auth/data/storage/functions in TypeScript (CDK)
- **Local backend**: `ampx sandbox` provisions a per-developer cloud sandbox and generates `amplify_outputs.json`
- **Secrets**: Amplify secrets (SSM Parameter Store) via `ampx sandbox secret set NAME` / `secret('NAME')`
- **Schema**: data models + authorization declared in `amplify/data/resource.ts`; the frontend shares the
  generated `Schema` type via `import type { Schema } from '@workspace/backend'`

### Key Features

- Passwordless Email OTP auth (Cognito)
- Code-first data models with per-model authorization (AppSync + DynamoDB)
- Private path-based file storage (S3)
- FastAPI compute on Lambda for AI/ML and Python-specific workloads
- Clean separation of concerns across the Amplify resources

## Requirements

- AWS 認証情報（`ampx sandbox` / デプロイ用のプロファイル）
- [devenv](https://devenv.sh/getting-started/) (Nix ベースの開発環境)
- [direnv](https://direnv.net/) + シェルフック設定

> Make は **不要**。日常コマンドはすべて devenv の **scripts** (PATH 直結) と **tasks** (`devenv tasks run <name>`) で提供される。Makefile は deprecated。

### devenv が提供するツール

以下のツールは devenv が自動で管理するため、個別インストールは不要です:

| ツール | 用途 |
|--------|------|
| Node.js 22 | Frontend, Amplify CLI (`ampx`) |
| Python 3.13 | Backend (FastAPI on Lambda) |
| Bun | Frontend / Amplify backend パッケージ管理 |
| uv | Python パッケージ管理 |
| Maestro | E2E テスト |

> シークレットは **Amplify secrets（SSM Parameter Store）** で管理する（`ampx sandbox secret set NAME`、参照は `secret('NAME')`）。`ampx sandbox` の実行・デプロイには AWS 認証情報（プロファイル）が必要。

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
# devenv: Node, Python, Bun, uv が PATH 上に揃う（バージョンは devenv.lock に固定）
```

- 初回のみ Nix ビルドが走るため数分かかります。2回目以降は数百ミリ秒です
- ディレクトリを離れると自動的にディアクティベートされます（`exit` は不要）
- `.envrc` の内容が変わった場合のみ、再度 `direnv allow` が必要になります

> **Note**: direnv を使わない場合は `devenv shell` で手動アクティベートできます。

### 4. AWS 認証情報の設定

`ampx sandbox` とデプロイには AWS 認証情報（プロファイル）が必要です。AWS CLI / SSO 等で
プロファイルを設定しておきます（例: `aws configure sso` または `aws configure --profile <name>`）。

`devenv shell` に入っただけで以下は **自動実行** される（`setup:*` task / `before = [ "devenv:enterShell" ]` + `execIfModified`）:

- Frontend 依存関係のインストール（`pnpm install --frozen-lockfile`）
- Backend Python 依存関係のインストール（`uv sync --frozen --group dev`）

### 5. シークレットの設定（Amplify secrets）

シークレットは **Amplify secrets（SSM Parameter Store）** で管理します。`amplify_outputs.json` などの
非機密 config は `ampx sandbox` が自動生成するため、手動の env ファイルは不要です。

```bash
# シークレットを設定（sandbox 用）
ampx sandbox secret set MY_SECRET

# バックエンド定義からは secret('MY_SECRET') で参照
```

### 6. Amplify backend（sandbox）の起動

```bash
sandbox        # ampx sandbox: per-dev クラウド sandbox をデプロイし amplify_outputs.json を生成（watch）
# sandbox-once # 1 回だけデプロイして終了
# sandbox-delete # sandbox を破棄
```

`amplify/data/resource.ts` などを編集すると watch 中の `sandbox` が差分を反映し、
`amplify_outputs.json` と `@workspace/backend` の `Schema` 型が更新されます。

## Execution

After successfully completing the setup, you can start the application using one of the following commands:

### Light default — `devenv up`

`devenv up` は dev サーバ群（storybook 等）を起動します。Amplify バックエンドは別途
`sandbox` (= `ampx sandbox`) を起動して使います（per-dev クラウド sandbox なので Docker は不要）。

```bash
sandbox     # 別ターミナルで Amplify backend を起動（amplify_outputs.json を生成・watch）
devenv up   # dev サーバ群 (TUI 付き)
stop        # devenv プロセス停止
```

TUI で各プロセスのリアルタイムログ・個別再起動が可能。

> 旧 Supabase ローカル Docker は撤去済み。バックエンドは `ampx sandbox` がクラウド上に per-dev で構築する。

### モノレポのフロントエンドアプリ起動 (opt-in)

`frontend/apps/<name>` 配下の各アプリは **opt-in process** として登録されており (`start.enable = false`)、`devenv up` 単体では起動しません。明示指定または preset script を使います:

| 起動内容 | コマンド |
|---|---|
| Storybook のみ | `storybook` |
| Next.js (web) | `dev-web` |
| Expo Metro (mobile, non-interactive) | `dev-mobile` |
| アプリ単独 (例: web のみ) | `devenv up web` |
| 任意組み合わせ | `devenv up storybook web` など |

> Expo の対話的 TUI（`r` でリロード、QR コード等）は devenv process では使えません。対話操作したい場合は別ターミナルで `mobile` / `mobile-ios` / `mobile-android` / `mobile-web` script を叩いてください (devenv 外で Expo TUI を直接起動)。

### `frontend/apps/` への新規アプリ追加

`devenv.nix` の `frontendApps` attrset に **1 行追加** するだけで以下が自動連動します:

- `processes.<name>` (start.enable=false で opt-in process 化)
- `scripts.dev-<name>` (= `devenv up storybook <name>`)

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

`devenv up storybook web` は storybook + 各アプリを **devenv の TUI で個別管理**。`frontend` script は **devenv 外で turbo dev** を 1 プロセスとして起動。用途で使い分け。

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

This project implements unified code quality management across all components (Frontend, Amplify backend, Backend Python).

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

#### Backend Python Specific (Ruff + MyPy)

```bash
lint-backend-py         # Ruff lint (auto-fix)
lint-backend-py-ci      # Ruff lint (CI, no fix)
format-backend-py       # Ruff format (auto-fix)
format-backend-py-check # Ruff format check
type-check-backend-py   # MyPy type check (strict mode)
```

### Development Tools

- Build frontend:

  ```bash
  build-frontend
  ```

- Build storybook:

  ```bash
  build-storybook
  ```

### Data Modeling (Amplify Data)

データモデルと認可は `frontend/packages/backend/amplify/data/resource.ts` にコードファーストで定義します。

```typescript
// amplify/data/resource.ts
const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
      done: a.boolean().default(false),
    })
    .authorization((allow) => [allow.owner()]),
})

export type Schema = ClientSchema<typeof schema>
```

- `a.model()` ごとに DynamoDB テーブル + AppSync GraphQL API が生成される
- 認可は `allow.owner()` / `allow.authenticated()` / `allow.guest()` 等で宣言（RLS の代替）
- フロントは `import type { Schema } from '@workspace/backend'` で型を共有し、`getDataClient()`
  （`@workspace/data-client`）でデータアクセスする

```bash
# 編集を sandbox に反映（amplify_outputs.json と Schema 型を更新、watch）
sandbox
```

### Deployment (Amplify Hosting)

ブランチ / 本番へのデプロイは **AWS Amplify Hosting** が `amplify.yml`（monorepo, appRoot=frontend）に従い
`ampx pipeline-deploy` + Next.js build を実行します。ローカルからの手動デプロイは不要です。

```yaml
# amplify.yml（抜粋）— Amplify Hosting がブランチ push を契機に実行
# backend: ampx pipeline-deploy --branch <branch> --app-id <app-id>
# frontend: pnpm install && pnpm run build
```

- バックエンド（auth/data/storage/functions）は `ampx pipeline-deploy` で当該ブランチ環境にデプロイ
- シークレットは Amplify secrets（SSM Parameter Store）でブランチ環境ごとに管理

# Development Guidelines

## Code Quality

- **Frontend & Amplify backend**: Biome for linting and formatting (all-in-one toolchain, replaces ESLint + Prettier), TypeScript strict mode
- **Backend**: Ruff for linting (line length: 88), MyPy for type checking
- **UI Design (Web)**: shadcn/ui + MagicUI components (Radix UI) with TailwindCSS 4 and CSS variables
- **UI Design (Mobile)**: gluestack-ui components with NativeWind 5
- **Package Manager**: [ni](https://github.com/antfu-collective/ni) (abstraction layer using Bun internally)
- **Build System**: Turbo for efficient monorepo builds

## Architecture Patterns

- **Frontend**: Feature-Sliced Design (FSD) with strict layer hierarchy (app → views → widgets → features → entities → shared)
- **Backend (Python)**: Clean architecture with Controllers, Use Cases, Gateways, and Infrastructure
- **Backend (Amplify)**: Code-first resources (auth/data/storage/functions) with per-model authorization

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
- **[next-intl](https://next-intl.dev/)**: Internationalization (en, ja)
- **[AWS Amplify Gen2](https://docs.amplify.aws/)**: Auth (Cognito), Data (AppSync + DynamoDB), Storage (S3), Functions (Lambda), Hosting
- **[Amazon Cognito](https://aws.amazon.com/cognito/)**: Authentication (passwordless Email OTP)
- **[FastAPI](https://fastapi.tiangolo.com/)**: Python backend framework (on AWS Lambda via Mangum)
- **[Amazon SNS](https://aws.amazon.com/sns/)**: Notifications
- **[Bun](https://bun.sh/)**: Fast package manager and JavaScript runtime
- **[Turbo](https://turbo.build/)**: High-performance build system for monorepos
- **[devenv](https://devenv.sh/)**: Nix-based development environment with process management
- **[Polar](https://polar.sh/)**: Payments (external SaaS)

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
