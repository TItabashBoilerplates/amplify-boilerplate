# AGENT.md

このファイルは Google Antigravity Agent がコードベースで作業する際のガイダンスを提供します。

**このリポジトリは AWS Amplify Gen2 ベースのフルスタック・ボイラープレートです。**
インフラはすべて AWS（Cognito / AppSync+DynamoDB / S3 / Lambda / SNS / Amplify Hosting）。

## CRITICAL - 推測実装の完全禁止

- **推測・記憶・一般知識に基づく実装は一切禁止**
- 実装前に必ず公式ドキュメントを確認すること
- ライブラリの API、設定ファイル形式、CLI 構文は**必ずファクトを調査**してから使用
- 「たぶんこうだろう」「以前こうだった」という推測での実装は**絶対に行わない**
- **モジュール・パッケージは必ず最新バージョンを調査し、最新のAPIを使用すること**
- **ビルド・テスト・リント等は必ず devenv のコマンド（scripts または `devenv tasks run`）を使用すること**
- **Amplify バックエンド（auth/data/storage/functions）の変更は `frontend/packages/backend/amplify/` を編集**し、`ampx sandbox` で反映する

> Makefile は **deprecated**。すべて devenv のコマンドへ移行済み。`make X` を叩くと案内メッセージのみ出力する。

## 会話言語

- 常に日本語で会話する

## Architecture Overview

Full-stack application boilerplate with multi-platform frontend and backend services.

### Tech Stack

| Layer                 | Technology                                            |
| --------------------- | ----------------------------------------------------- |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, Bun                 |
| **Frontend (Mobile)** | Expo 55, React Native, TypeScript                     |
| **UI (Web)**          | shadcn/ui, Radix UI, TailwindCSS 4                    |
| **UI (Mobile)**       | gluestack-ui, NativeWind 5, TailwindCSS 4             |
| **State**             | TanStack Query (server), Zustand (global)             |
| **Architecture**      | Feature Sliced Design (FSD)                           |
| **i18n**              | next-intl (en, ja)                                    |
| **Auth**              | Amazon Cognito（Amplify Auth, Email OTP passwordless）|
| **Data**              | AWS AppSync + DynamoDB（Amplify Data, `a.schema`）    |
| **Storage**           | Amazon S3（Amplify Storage）                          |
| **Backend (compute)** | FastAPI on AWS Lambda（Amplify custom function, Python + Mangum）|
| **Notifications**     | Amazon SNS                                            |
| **Secrets**           | Amplify secrets（SSM Parameter Store）                |
| **Hosting / CI-CD**   | AWS Amplify Hosting（`amplify.yml`）                  |

### Package Management

| Component                                  | Package Manager   |
| ------------------------------------------ | ----------------- |
| Frontend Web (`frontend/apps/web/`)        | **Bun**           |
| Frontend Mobile (`frontend/apps/mobile/`)  | **Bun**           |
| Amplify backend (`frontend/packages/backend`) | **Bun**（`ampx`） |
| Backend Python (`backend-py/`)             | **uv**            |

---

## Core Policies (MANDATORY)

以下のポリシーは**必須**です。詳細は `.agent/rules/` の各ファイルを参照：

| ポリシー | 説明 | ファイル |
|---------|------|---------|
| **Research-First** | 実装前に公式ドキュメント確認必須 | `research-first.md` |
| **TDD** | テスト駆動開発、All Green必須 | `testing.md` |
| **Commands** | devenv の scripts / `devenv tasks run` 使用必須 | `command-guidelines.md` |
| **Amplify-First** | Amplify Data（AppSync）優先、Lambda バックエンドは最終手段 | `architecture.md` |
| **i18n** | 多言語対応必須（en, ja） | `i18n.md` |
| **DateTime** | UTC保存、Frontend変換 | `date-time-handling.md` |
| **Clean Code** | 後方互換禁止、重複禁止 | `clean-code.md` |
| **UI Testing** | UI は Storybook、単体テスト不要 | `ui-testing.md` |
| **Debugging** | devenv 2.0 の native process manager TUI を主インターフェース | `debugging.md` |

---

## Development Commands

すべて devenv shell（direnv 経由）で PATH 上に存在する **scripts** か、`devenv tasks run <name>` で起動する **tasks**。`make X` は使わない。

```bash
# Setup
bootstrap                     # 依存インストール（frontend: bun / backend-py: uv）
# `devenv shell` 進入（direnv 経由含む）で setup:* タスクが自動実行される場合あり。

# Amplify backend（Supabase ローカル Docker の代替）
sandbox                       # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成）
sandbox-once                  # 1 回デプロイして終了
sandbox-delete                # sandbox 破棄

# Dev servers
dev-web                       # Next.js (web)
dev-mobile                    # Expo Metro (mobile)
storybook                     # Storybook

# Quality
lint                          # 全プロジェクトの lint (auto-fix)
format                        # 全プロジェクトの format (auto-fix)
format-check                  # 各 sub-project の format-check
type-check-frontend           # Frontend 型チェック
type-check-backend-py         # Backend Python 型チェック
ci-check                      # = `devenv test`、ci:check aggregator 経由（キャッシュ込み）
devenv test                   # ci-check と同等。ローカル/CI で同じコマンド

# Tests
unit-test                     # 全 unit test (frontend + backend-py)
test-frontend                 # Vitest
test-backend-py               # pytest
e2e / e2e-web / e2e-mobile    # Maestro E2E
```

> ⚠️ `sandbox` / デプロイには AWS 認証情報（プロファイル）が必要。

---

## Secrets Configuration

シークレット（API キー・トークン等）は **Amplify secrets（SSM Parameter Store）** で管理する。

```bash
# シークレット設定（per-dev sandbox）
ampx sandbox secret set NAME

# バックエンド定義からの参照
secret('NAME')   # frontend/packages/backend/amplify/ 内で利用
```

> 非機密 config（公開 URL・公開キー等）は通常のフロントエンド環境変数で扱う。

---

## Amplify Backend Configuration

Amplify Gen2 のモノレポ・ベストプラクティスに従い、バックエンド定義を共有ワークスペース
パッケージ `@workspace/backend` に集約：

| Setting                 | Location                                                  |
| ----------------------- | -------------------------------------------------------- |
| Auth (Cognito, Email OTP) | `frontend/packages/backend/amplify/auth/resource.ts`     |
| Data schema / 認可ルール  | `frontend/packages/backend/amplify/data/resource.ts`     |
| Storage (S3) buckets    | `frontend/packages/backend/amplify/storage/resource.ts`  |
| Lambda function (FastAPI) | `frontend/packages/backend/amplify/functions/api/resource.ts` |
| Backend 配線 (SNS 等)    | `frontend/packages/backend/amplify/backend.ts`           |

> **認可（旧 RLS）は schema に集約**: `a.model(...).authorization((allow) => [allow.owner()])` のように
> `amplify/data/resource.ts` 内で宣言する。フロントは `import type { Schema } from '@workspace/backend'`
> で型共有し、`getDataClient()`（`@workspace/data-client`）でデータアクセスする。

---

## Domain Documentation

| ドメイン          | ドキュメント                                                       |
| ----------------- | ------------------------------------------------------------------ |
| Frontend (Web)    | [`frontend/README.md`](frontend/README.md)                         |
| Frontend (Mobile) | [`frontend/apps/mobile/README.md`](frontend/apps/mobile/README.md) |
| Amplify Backend   | [`frontend/packages/backend/README.md`](frontend/packages/backend/README.md) |
| Backend Python    | [`backend-py/README.md`](backend-py/README.md)                     |

---

## AI/ML Features

- **LLM Orchestration**: LangChain/LangGraph
- **Providers**: OpenAI, Anthropic, Replicate, FAL
- **Real-time**: LiveKit

→ 詳細は [`backend-py/README.md`](backend-py/README.md)

---

## Rules Reference

詳細なルールは `.agent/rules/` を参照：

- `index.md` - ルール一覧とナビゲーション
- `architecture.md` - アーキテクチャ概要
- `code-style.md` - コードスタイル
- `testing.md` - テスト方針（TDD）
- `clean-code.md` - クリーンコード
- `ui-testing.md` - UIテスト（Storybook）
- `debugging.md` - デバッグ（devenv 2.0 native CLI 優先・ampx sandbox）
