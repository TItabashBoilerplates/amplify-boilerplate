# Minimal Implementation Policy（Write Less Code）

**MANDATORY**: 実装は常に最小量にする。**書かなかったコードはバグらず、レビュー不要で、
保守も要らない。** 実装の良し悪しは「どれだけ作ったか」ではなく
**「どれだけ作らずに要件を満たしたか」**で評価する。

正本: `/.claude/rules/minimal-implementation.md`

## 意思決定順序（上位で解決できるものを下位で実装しない）

| # | 選択肢 |
|---|---|
| 1 | **リポジトリ内の既存資産** — `frontend/packages/*`（`ui` / `native-ui` / `query` / `auth` / `data-client` / `backend-core` / `logger` / `types` / `api-client`）、アプリ内の `shared/` `entities/`、`backend-py/packages/core`。**まず grep する** |
| 2 | **プラットフォーム標準** — Web / 言語標準、React 19・Next.js 16、Amplify Data（型・認可・セカンダリインデックス・サブスクリプション） |
| 3 | **AWS マネージド** — Cognito / AppSync+DynamoDB / S3 / Lambda / SES / SNS・Pinpoint / Bedrock / SQS / EventBridge / Step Functions / CloudWatch / Amplify Hosting / SSM |
| 4 | **実績のある OSS**（選定基準を満たすもののみ） |
| 5 | **スクラッチ**（1〜4 がいずれも該当しないと確認できた場合のみ） |

## 絶対に自作しないもの

暗号・トークン検証 / 認証・セッション（Cognito）/ 認可（Amplify Data の `authorization`）/
決済 / 日時・ロケール（`Intl`）/ メール到達性（SES）/ プッシュ（Pinpoint）/
シークレット（Amplify secrets）。

## 逆に、依存を足すべきでない場合

数行〜数十行で書ける trivial な処理、プロダクト固有のドメインロジック、
bundle size / native module / ライセンスのコストが便益に見合わないもの。
**依存を 1 つ増やす = 保守対象を 1 つ増やす。**

## 共通化の判断

Rule of Three。ただし**不整合が事故になるもの**（スタイル定数・クエリキー・`PAGE_SIZE`・
バリデーション規則・API 契約）は 2 回目で即共通化する。
**誤った抽象化は重複より高くつく**（Sandi Metz）。

共通化のために **FSD の依存方向・公開 API・monorepo の境界を壊すのは禁止**。

## ライブラリ選定

`pnpm info` / `pnpm outdated` / `pnpm why` / `pnpm audit` / deps.dev / OpenSSF Scorecard で
**実際に確認**する。**star 数は単独の根拠にならない**（購入可能。約 600 万件の fake star 疑いが
報告されている）。AGPL / SSPL / BUSL は必ずユーザー確認。

## ただし品質は削らない

型を `any` で潰す、catch を省く、テスト・i18n・ページングを省くのは
**削減ではなく違反**。減らすのは実装の総量であって保守性ではない。
