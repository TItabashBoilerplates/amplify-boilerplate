---
description: "Write Less Code - reuse existing assets, platform features and AWS managed services before writing anything"
alwaysApply: true
globs: []
---
# Minimal Implementation (Write Less Code)

**MANDATORY**: 実装は常に最小量にする。**書かなかったコードはバグらず、レビュー不要で、保守も要らない。**

正本: `/.claude/rules/minimal-implementation.md`

## 意思決定順序（上位で解決できるものを下位で実装しない）

1. **リポジトリ内の既存資産** — `frontend/packages/*`（`ui` / `native-ui` / `query` / `auth` /
   `data-client` / `backend-core` / `logger` / `types` / `api-client`）、`shared/` `entities/`、
   `backend-py/packages/core`。**まず grep する**
2. **プラットフォーム標準** — Web/言語標準（`Intl` / `URL` / `crypto.randomUUID`）、
   React 19 / Next.js 16、Amplify Data（型・認可・セカンダリインデックス・サブスクリプション）
3. **AWS マネージド** — Cognito / AppSync+DynamoDB / S3 / Lambda / SES / SNS・Pinpoint /
   Bedrock / SQS / EventBridge / Step Functions / CloudWatch / Amplify Hosting / SSM
4. **実績ある OSS**（選定基準を満たすもののみ）
5. **スクラッチ**（1〜4 がいずれも該当しないと確認できた場合のみ）

## 絶対に自作しないもの

暗号 / 認証・セッション / 認可（Amplify Data の `authorization`）/ 決済 /
日時・ロケール（`Intl`）/ メール到達性（SES）/ プッシュ（Pinpoint）/ シークレット（Amplify secrets）

## ライブラリ選定

`pnpm info` / `pnpm outdated` / `pnpm why` / `pnpm audit` / deps.dev / OpenSSF Scorecard で
**実際に確認**する。**star 数は単独の根拠にならない**（購入可能）。
AGPL / SSPL / BUSL は必ずユーザー確認。既に採用済みの領域（shadcn/ui、gluestack-ui、
TanStack Query、Zustand、next-intl、Amplify Data、Hey API）へ役割の重複するものを持ち込まない。

## ただし品質は削らない

FSD の依存方向 / 公開 API / monorepo の境界を壊す、`any` で潰す、テスト・エラーハンドリング・
i18n・ページングを省く — これらは**削減ではなく違反**。
