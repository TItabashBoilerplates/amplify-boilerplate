# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**このリポジトリは AWS Amplify Gen2 ベースのフルスタック・ボイラープレートです。**
インフラはすべて AWS（Cognito / AppSync+DynamoDB / S3 / Lambda / SNS / Amplify Hosting）。
Supabase / Vercel / Railway / Doppler / Drizzle / Deno Edge Functions / OneSignal は使いません。

**CRITICAL - 推測実装の完全禁止**:

- **タスク開始前に、必ず利用可能な Skill を確認し、該当するものがあれば最初に `Skill` ツールで起動すること**（`.claude/rules/skills-first.md`）
- **推測・記憶・一般知識に基づく実装は一切禁止**。実装前に必ず公式ドキュメント（Context7 MCP / WebSearch / WebFetch）でファクトを確認（`.claude/rules/research.md`）
- **モジュール・パッケージは必ず最新バージョンを調査し、最新の API を使用**
- **ビルド・テスト・リント等は devenv のコマンド（scripts または `devenv tasks run`）を使用**（`.claude/rules/commands.md`）
- **Amplify バックエンド（auth/data/storage/functions）の変更は `frontend/packages/backend/amplify/` を編集**し、`ampx sandbox` で反映する
- **AWS ファースト: 必要機能は AWS エコシステム内で賄う。外部 SaaS は AWS で要件的に厳しい場合のみ（理由明記+ユーザー確認）。例外は決済 Polar のみ**（`.claude/rules/aws-first.md`）
- **バックエンドの既定は TypeScript（Amplify Functions / Node `defineFunction`）。Python（backend-py）は特殊要件（LLM/長時間/Python固有）のときだけ**（`.claude/rules/backend-architecture.md`）
- **TS のパッケージマネージャは pnpm（`pnpm add`/`pnpm install`）。npm/yarn/bun 禁止（ampx が bun 非対応）。Python は uv**（`.claude/rules/backend-architecture.md`）
- **生成AI: 対話的=SSE / 背景処理(≤15分)=worker Lambda+DBステータス / 超長時間(>15分)・サンドボックス=Amazon Bedrock AgentCore。監視は Amplify リアルタイム(AppSync サブスク)。LLM は LangChain**（`.claude/rules/generative-ai.md`）
- **実装量は常に最小化。既存資産 → 標準機能 → AWS マネージド → 実績ある OSS → スクラッチ の順で必ず検討**（`.claude/rules/minimal-implementation.md`）
- **モバイルを出すなら認証は「メール + パスワード」必須（OTP のみ禁止）。メール再設定・パスワード忘れ・パスワード変更・アカウント削除の導線も指示を待たず実装**（`.claude/rules/auth.md`）
- **データモデル（`a.schema`）の破壊的変更はデータ消失。本番反映は必ずユーザー承認**（`.claude/rules/data-modeling.md`）
- **秘匿値は Amplify secrets（SSM）。`AWS` / `AMPLIFY_` / `_` prefix の環境変数は作らない**（`.claude/rules/env-naming.md`）

## 最優先の設計思想: FSD × モノレポ

このボイラープレートの核は **Feature-Sliced Design (FSD)** と **モノレポ**。この2つは何があっても維持する。

- **モノレポ**: `frontend/`（pnpm workspace + Turborepo）に web/mobile アプリと共有 `packages/*`。`backend-py/`（uv workspace）に Python。
- **FSD**: 各アプリ `src/` は `app → views → widgets → features → entities → shared` のレイヤー階層。上位→下位の依存のみ。各スライスは `index.ts` で Public API を公開。
- **配置判断**: Web/Mobile 共通ロジックは `packages/*`、アプリ固有は各 `apps/*/src` の FSD レイヤー。詳細は `.claude/rules/render-optimization.md`（state 所有権）/ `.claude/rules/frontend.md`。

## Memory Structure

```
.claude/
├── rules/          # 常に適用されるポリシー
│   ├── skills-first.md   research.md   commands.md
│   ├── minimal-implementation.md   clean-code.md   tdd.md   error-handling.md
│   ├── aws-first.md   backend-architecture.md   generative-ai.md
│   ├── data-modeling.md   auto-generated.md   env-naming.md
│   ├── auth.md   storage-images.md   list-pagination.md
│   ├── frontend.md   backend-py.md   python-monorepo.md
│   ├── render-optimization.md   page-navigation.md
│   ├── form-controls.md   mobile-uiux.md   store-review.md
│   ├── i18n.md   ui-testing.md   datetime.md
└── skills/         # 技術別ガイダンス（**amplify-gen2** / FSD / monorepo / nextjs / fastapi / tanstack-query 等）
```

> 注: 旧スタック専用の skill（supabase-config / drizzle / rls / pgtap / edge-functions-mcp /
> hey-api / seed 等）は削除済み。汎用 skill（datetime / data-fetching / fastapi / tanstack-query /
> monorepo / maestro 等）は Amplify スタックの例に更新済み。

## Architecture Overview

### Tech Stack

| Layer                 | Technology                                            |
| --------------------- | ----------------------------------------------------- |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, pnpm                 |
| **Frontend (Mobile)** | Expo 55, React Native, TypeScript                     |
| **UI (Web)**          | shadcn/ui, Radix UI, TailwindCSS 4                    |
| **UI (Mobile)**       | gluestack-ui, NativeWind 5                            |
| **State**             | TanStack Query (server), Zustand (global)             |
| **Architecture**      | Feature-Sliced Design (FSD) + monorepo                |
| **i18n**              | next-intl (en, ja)                                    |
| **Auth**              | Amazon Cognito（Amplify Auth。`otpLogin: true` で **メール+パスワード と Email OTP の両方**）|
| **Data**              | AWS AppSync + DynamoDB（Amplify Data, `a.schema`）    |
| **Storage**           | Amazon S3（Amplify Storage）                          |
| **Backend (compute)** | **既定: TypeScript Amplify Functions（Node `defineFunction`）**／Python が必須のときだけ FastAPI on Lambda（Python + Mangum, escalation 用に同梱）|
| **Notifications**     | Amazon SNS（モバイルプッシュは Pinpoint を別途）       |
| **Secrets**           | Amplify secrets（SSM Parameter Store）                |
| **Hosting / CI-CD**   | AWS Amplify Hosting（`amplify.yml`）                  |

### Amplify バックエンド（`frontend/packages/backend/`）

Amplify Gen2 のモノレポ・ベストプラクティスに従い、バックエンド定義を共有ワークスペース
パッケージ `@workspace/backend` に集約:

```
packages/backend/amplify/
├── backend.ts            # defineBackend({ auth, data, storage, api }) + SNS 配線
├── auth/resource.ts      # Cognito（メール+パスワード / Email OTP）
├── data/resource.ts      # AppSync + DynamoDB（a.schema, userPool 認可）
├── storage/resource.ts   # S3（非公開・path 単位アクセス）
└── functions/api/        # Python escalation 用の同梱例（FastAPI Lambda, CDK）。既定の新規関数は Node defineFunction（TS）
```

> バックエンドは**原則すべて Amplify ベストプラクティス（TS）で実装**する。`backend-py/` の Python 環境は
> §`backend-architecture.md` のトリガー（LLM/長時間/Python固有/既存資産）に該当するときだけ使う escalation 用で、
> **使う必要がなければ使わなくてよい**。

フロントは `import type { Schema } from '@workspace/backend'` で型共有、
`getDataClient()`（`@workspace/data-client`）でデータアクセス。

## Quick Reference

```bash
# Setup
bootstrap                       # 依存インストール（frontend: pnpm / backend-py: uv）

# Amplify backend（Supabase ローカル Docker の代替）
sandbox                         # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成）
sandbox-once                    # 1回デプロイして終了
sandbox-delete                  # sandbox 破棄

# Dev servers
dev-web                         # Next.js (web)
dev-mobile                      # Expo (mobile)
storybook                       # Storybook

# Quality（必ず devenv のコマンドで）
lint / format                   # 全体 lint / format
type-check-frontend / type-check-backend-py
unit-test                       # 全 unit test（frontend + backend-py）

# Deploy（CI）
# Amplify Hosting が amplify.yml に従い ampx pipeline-deploy + Next.js build を実行
```

> ⚠️ `sandbox` / デプロイには AWS 認証情報（プロファイル）が必要。

### MANDATORY（要約）

- **FSD × モノレポ維持**（最優先）。`.claude/rules/render-optimization.md` / `frontend.md`。
- **i18n 必須**（全ユーザー向けテキスト、en+ja）。`.claude/rules/i18n.md`。
- **TDD 厳守 / All Green**。UI は Storybook で担保。`.claude/rules/tdd.md` / `ui-testing.md`。
- **クリーンコード**（後方互換・重複・未使用を残さない）。`.claude/rules/clean-code.md`。
- **エラーを握りつぶさない**。`.claude/rules/error-handling.md`。
- **再描画最小化**（FSD スライス単位の state 局所化）。`.claude/rules/render-optimization.md`。
- **ページ遷移は loading.tsx + Suspense でストリーミング**。`.claude/rules/page-navigation.md`。
- **実装は最小量に**（既存資産 → 標準機能 → AWS マネージド → 実績ある OSS → スクラッチ）。`.claude/rules/minimal-implementation.md`。
- **認証はモバイルならメール+パスワード必須**、再設定導線 4 種は必ず実装。`.claude/rules/auth.md`。
- **一覧は最初からページング**（終端判定は `nextToken`。`length < limit` で打ち切らない）。`.claude/rules/list-pagination.md`。
- **S3 の画像は表示サイズに合わせて配信**（原本を配らない）。`.claude/rules/storage-images.md`。
- **フォーム要素はモバイル幅で 16px 以上**（iOS のオートズーム禁止）。`.claude/rules/form-controls.md`。
- **モバイル UI はキーボードが画面の 4〜5 割を覆う前提で作る**。`.claude/rules/mobile-uiux.md`。
- **ストア審査の不変条件を壊さない**。`.claude/rules/store-review.md`。
- **データモデルの破壊的変更は本番でデータ消失**。`.claude/rules/data-modeling.md`。
- **生成物を手で編集しない / `amplify_outputs.json` をコミットしない**。`.claude/rules/auto-generated.md`。
- **秘匿値は Amplify secrets。予約 prefix の env を作らない**。`.claude/rules/env-naming.md`。

## Package Management

| Component                       | Package Manager |
| ------------------------------- | --------------- |
| Frontend Web / Mobile           | **pnpm**        |
| Amplify backend (`packages/backend`) | **pnpm**（`ampx`） |
| Backend Python (`backend-py/`)  | **uv**          |
