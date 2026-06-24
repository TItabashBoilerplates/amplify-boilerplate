# AGENTS.md

このファイルは OpenAI Codex がコードベースで作業する際のガイダンスを提供します。

**このリポジトリは AWS Amplify Gen2 ベースのフルスタック・ボイラープレートです。**
インフラはすべて AWS（Cognito / AppSync+DynamoDB / S3 / Lambda / SNS / Amplify Hosting）。

## CRITICAL - 推測実装の完全禁止

- **推測・記憶・一般知識に基づく実装は一切禁止**
- 実装前に必ず公式ドキュメントを確認すること
- ライブラリの API、設定ファイル形式、CLI 構文は**必ずファクトを調査**してから使用
- 「たぶんこうだろう」「以前こうだった」という推測での実装は**絶対に行わない**
- **モジュール・パッケージは必ず最新バージョンを調査し、最新のAPIを使用すること**
- **ビルド・テスト・リント等は必ず devenv のコマンド（scripts または `devenv tasks run`）を使用すること**
- **Amplify バックエンド（auth/data/storage/functions）の変更は `frontend/packages/backend/amplify/` を編集**し、`ampx sandbox` で反映すること

## 会話言語

- 常に日本語で会話する

## 最優先の設計思想: FSD × モノレポ

このボイラープレートの核は **Feature-Sliced Design (FSD)** と **モノレポ**。この2つは何があっても維持する。

- **モノレポ**: `frontend/`（Bun workspace + Turborepo）に web/mobile アプリと共有 `packages/*`。`backend-py/`（uv workspace）に Python。Amplify backend は `frontend/packages/backend/`（`@workspace/backend`）に集約。
- **FSD**: 各アプリ `src/` は `app → views → widgets → features → entities → shared` のレイヤー階層。上位→下位の依存のみ。各スライスは `index.ts` で Public API を公開。
- **配置判断**: Web/Mobile 共通ロジックは `packages/*`、アプリ固有は各 `apps/*/src` の FSD レイヤー。

## Architecture Overview

Full-stack application boilerplate with multi-platform frontend and AWS Amplify Gen2 backend.

### Tech Stack

| Layer                 | Technology                                                       |
| --------------------- | --------------------------------------------------------------- |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, Bun                           |
| **Frontend (Mobile)** | Expo 55, React Native, TypeScript                               |
| **UI (Web)**          | shadcn/ui, Radix UI, TailwindCSS 4                             |
| **UI (Mobile)**       | gluestack-ui, NativeWind 5, TailwindCSS 4                      |
| **State**             | TanStack Query (server), Zustand (global)                      |
| **Architecture**      | Feature Sliced Design (FSD) + monorepo                         |
| **i18n**              | next-intl (en, ja)                                            |
| **Auth**              | Amazon Cognito（Amplify Auth, passwordless Email OTP）         |
| **Data**              | AWS AppSync + DynamoDB（Amplify Data, `a.schema`）             |
| **Storage**           | Amazon S3（Amplify Storage）                                   |
| **Backend (compute)** | FastAPI on AWS Lambda（Amplify Python custom function + Mangum）|
| **Notifications**     | Amazon SNS（モバイルプッシュは Pinpoint を別途）               |
| **Secrets**           | Amplify secrets（SSM Parameter Store）                         |
| **Payments**          | Polar                                                          |
| **Hosting / CI-CD**   | AWS Amplify Hosting（`amplify.yml`）                          |

### Package Management

| Component                                       | Package Manager |
| ----------------------------------------------- | --------------- |
| Frontend Web (`frontend/apps/web/`)             | **Bun**         |
| Frontend Mobile (`frontend/apps/mobile/`)       | **Bun**         |
| Amplify backend (`frontend/packages/backend/`)  | **Bun**（`ampx`）|
| Backend Python (`backend-py/`)                  | **uv**          |

---

## Core Policies (MANDATORY)

以下のポリシーは**必須**です。詳細は `.codex/skills/` の各ファイルを参照：

| ポリシー | 説明 |
|---------|------|
| **Research-First** | 実装前に公式ドキュメント確認必須 |
| **TDD** | テスト駆動開発、All Green必須 |
| **Commands** | devenv の scripts / `devenv tasks run` 使用必須 |
| **Auto-Generated** | 自動生成ファイル（`amplify_outputs.json` 等）編集禁止 |
| **Amplify-First** | データアクセスは Amplify Data（`getDataClient()`）優先、FastAPI Lambda は LLM / 長時間処理など複雑実装の escalation 先 |
| **i18n** | 多言語対応必須（en, ja） |
| **DateTime** | UTC保存、Frontend変換 |
| **Clean Code** | 後方互換禁止、重複禁止 |
| **UI Testing** | UI は Storybook、単体テスト不要 |

---

## Development Commands

すべて devenv shell（direnv 経由）で PATH 上に存在する **scripts** か、`devenv tasks run <name>` で起動する **tasks**。

```bash
# Setup
bootstrap                     # 依存インストール（frontend: bun / backend-py: uv）
                              #   通常は `devenv shell` 進入時に自動実行

# Amplify backend（Supabase ローカル Docker の代替）
sandbox                       # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成）
sandbox-once                  # 1回デプロイして終了（CI/検証向け）
sandbox-delete                # sandbox 破棄

# Dev servers
dev-web                       # Next.js (web)
dev-mobile                    # Expo Metro (mobile)
storybook                     # Storybook

# Quality
lint                          # 全プロジェクトの lint (auto-fix)
format                        # 全プロジェクトの format (auto-fix)
type-check-frontend           # Frontend 型チェック
type-check-backend-py         # Backend Python 型チェック
unit-test                     # 全 unit test (frontend + backend-py)
ci-check                      # CI チェック (lint + format + type-check)

# Tests
test-frontend                 # Vitest
test-backend-py               # pytest
e2e / e2e-web / e2e-mobile    # Maestro E2E

# Deploy（CI）
# Amplify Hosting が amplify.yml に従い ampx pipeline-deploy + Next.js build を実行
```

> ⚠️ `sandbox` / デプロイには AWS 認証情報（プロファイル）が必要。

---

## Amplify バックエンド（`frontend/packages/backend/`）

Amplify Gen2 のモノレポ・ベストプラクティスに従い、バックエンド定義を共有ワークスペース
パッケージ `@workspace/backend` に集約:

```
packages/backend/amplify/
├── backend.ts            # defineBackend({ auth, data, storage, api }) + SNS 配線
├── auth/resource.ts      # Cognito（Email OTP passwordless）
├── data/resource.ts      # AppSync + DynamoDB（a.schema, userPool 認可）
├── storage/resource.ts   # S3（非公開・path 単位アクセス）
└── functions/api/        # FastAPI を載せた Python Lambda（CDK, PYTHON_3_13 + Mangum）
```

- **Auth = Amazon Cognito**: パスワードレス Email OTP。クライアントは `aws-amplify/auth`（`signIn` USER_AUTH + EMAIL_OTP / `confirmSignIn` / `resendSignInCode` / `signOut`）。サーバー（Next.js）は `runWithAmplifyServerContext`（`@/shared/lib/amplify/server`）+ `getCurrentUser` / `fetchAuthSession`（`aws-amplify/auth/server`）。認証ユーティリティは `@workspace/auth`。
- **Data = AppSync + DynamoDB**: コードファースト・スキーマを `data/resource.ts` の `a.schema(...)` で定義。`a.model(...).authorization((allow) => [allow.owner()])` のように宣言し、**認可ルールが RLS を置き換える**。フロントは `import type { Schema } from '@workspace/backend'` で型共有、`getDataClient()`（`@workspace/data-client`、`generateClient<Schema>()` のラッパー）でアクセス（例: `getDataClient().models.Todo.list()`）。
- **Storage = Amazon S3**: `defineStorage` で非公開・path 単位アクセス。
- **Backend compute = FastAPI on Lambda**: `functions/api/resource.ts` が CDK `Function`(PYTHON_3_13) を定義し、`backend-py` を Lambda にバンドル。ハンドラは `api.lambda_handler.handler`（Mangum が FastAPI を Lambda に適合）。認可は Cognito JWT 検証（`backend-py/apps/api/src/api/middleware/auth_middleware.py`）。
- **Notifications = Amazon SNS**: `backend.ts` で SNS トピックを作成し FastAPI Lambda に publish 権限を付与。モバイルプッシュは Pinpoint を別途追加する想定。

データモデル・認可・ストレージ・関数の変更は `frontend/packages/backend/amplify/` を編集し、`ampx sandbox`（= `sandbox` script）で per-dev のクラウド sandbox に反映する（Supabase ローカル Docker の代替）。`amplify_outputs.json` が生成され、フロントはこれで `Amplify.configure()` する（git 管理外）。

---

## Secrets（Amplify secrets）

シークレットは **Amplify secrets（SSM Parameter Store）** で管理する。

```bash
# sandbox にシークレットを設定
ampx sandbox secret set MY_SECRET

# backend 定義（resource.ts）から参照
# import { secret } from '@aws-amplify/backend'
# secret('MY_SECRET')
```

---

## Hosting / CI-CD

- **Hosting**: AWS Amplify Hosting（monorepo, `appRoot=frontend`）。ビルド設定は `amplify.yml`。
- **Branch / prod deploy**: Amplify Hosting が `ampx pipeline-deploy` を実行。
- **CI**: `.github/workflows/ci.yml`（bun biome + uv ruff/mypy/pytest）。

---

## Domain Documentation

| ドメイン          | ドキュメント                                                                            |
| ----------------- | --------------------------------------------------------------------------------------- |
| Frontend (Web)    | [`frontend/README.md`](../frontend/README.md)                                           |
| Frontend (Mobile) | [`frontend/apps/mobile/README.md`](../frontend/apps/mobile/README.md)                   |
| Amplify Backend   | [`frontend/packages/backend/README.md`](../frontend/packages/backend/README.md)         |
| Backend Python    | [`backend-py/README.md`](../backend-py/README.md)                                       |

---

## AI/ML Features

- **LLM Orchestration**: LangChain/LangGraph（FastAPI Lambda 上）
- **Providers**: OpenAI, Anthropic ほか

→ 詳細は [`backend-py/README.md`](../backend-py/README.md)

---

## Skills Reference

質問時に参照するガイダンス：

| スキル | 説明 |
|-------|------|
| `fsd/` | Feature Sliced Design |
| `monorepo/` | Bun workspace 構成 |
| `tanstack-query/` | TanStack Query v5 |
| `datetime/` | 日時処理 |
| `shadcn-ui/` | shadcn/ui + TailwindCSS (Web) |
| `gluestack/` | gluestack-ui + NativeWind (Mobile) |
| `storybook/` | Storybook コンポーネントカタログ |
| `python-testing/` | Python単体テスト |
| `i18n/` | next-intl 多言語対応 |
| `langchain/` | LangChain/LangGraph/LangSmith |
| `maestro/` | Maestro E2Eテスト |
