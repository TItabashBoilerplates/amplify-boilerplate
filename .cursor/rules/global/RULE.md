---
description: "Project-wide rules for tech stack, commands, and architecture policies"
alwaysApply: true
globs: []
---
# Project Global Rules

**このリポジトリは AWS Amplify Gen2 ベースのフルスタック・ボイラープレート**。
インフラはすべて AWS（Cognito / AppSync+DynamoDB / S3 / Lambda / SNS / Amplify Hosting）。
Supabase / Vercel / Railway / Doppler / Drizzle / Deno Edge Functions / OneSignal は使わない。

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend Web | Next.js 16, React 19, shadcn/ui, TailwindCSS 4 |
| Frontend Mobile | Expo, React Native, gluestack-ui, NativeWind |
| Auth | Amazon Cognito（Amplify Auth。password + Email OTP） |
| Data | AWS AppSync + DynamoDB（Amplify Data、`a.schema`） |
| Storage | Amazon S3（Amplify Storage） |
| Backend (compute) | Amplify Functions（TypeScript 既定）／FastAPI on Lambda（escalation） |
| Secrets | Amplify secrets（SSM Parameter Store） |
| Hosting / CI-CD | AWS Amplify Hosting（`amplify.yml`） |
| Package manager | **pnpm**（TS）/ **uv**（Python）。npm / yarn / bun は禁止 |

## Core Policies (MANDATORY)

| ポリシー | ルール |
|---------|--------|
| Research-First | `@research` - 実装前に公式ドキュメント確認 |
| Minimal Implementation | `@minimal-implementation` - 既存資産 → 標準機能 → AWS マネージド → OSS → スクラッチ |
| TDD | `@tdd` - テスト駆動開発、All Green 必須 |
| Commands | `@commands` - devenv scripts/tasks 使用必須（Makefile は削除済み） |
| AWS-First | `@aws-first` - 機能は AWS 内で賄う |
| Backend Architecture | `@backend-architecture` - TS の Amplify Functions が既定 |
| Data Modeling | `@data-modeling` - 認可必須・破壊的変更はデータ消失 |
| Auth | `@auth` - モバイルはメール+パスワード必須・再設定導線 4 種 |
| Auto-Generated | `@auto-generated` - 生成ファイル編集禁止・`amplify_outputs.json` は非追跡 |
| Env Naming | `@env-naming` - `AWS`/`AMPLIFY_`/`_`/`GITHUB_` prefix 禁止・秘匿値は SSM |
| List Pagination | `@list-pagination` - 一覧は最初からページング・終端は `nextToken` |
| Storage Images | `@storage-images` - S3 の画像は表示サイズで配信 |
| Form Controls | `@form-controls` - モバイル幅の入力欄は 16px 以上 |
| Mobile UI/UX | `@mobile-uiux` - キーボードが画面の半分を覆う前提 |
| Store Review | `@store-review` - 審査の不変条件 |
| Generative AI | `@generative-ai` - SSE / worker Lambda / AgentCore |
| i18n | `@i18n` - 多言語対応必須 |
| DateTime | `@datetime` - UTC 保存、Frontend 変換 |
| Debugging | `@debugging` - devenv 2.0 native process manager の TUI 最優先 |

## Commands

devenv の **scripts**（PATH 直結）を使用する。

```bash
lint / format          # 全プロジェクト
type-check             # 型チェック
unit-test              # 全テスト（`test` は bash 組み込みと衝突するため）
sandbox                # Amplify backend を per-dev のクラウド sandbox へ反映
build-storybook && verify-storybook-render   # UI の描画を実測
```

正本: `/.claude/rules/commands.md`

## i18n (MANDATORY)

- All UI text via next-intl
- Both `en.json` and `ja.json` required
