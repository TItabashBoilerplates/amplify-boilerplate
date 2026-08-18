---
description: "AWS-First architecture: cover requirements inside the AWS ecosystem; external SaaS only with justification"
alwaysApply: true
globs: []
---
# AWS-First Architecture

**MANDATORY**: 必要な機能は原則 **AWS エコシステム内**で賄う。外部 SaaS は
「AWS では要件的に明確に厳しい」場合のみ（理由を明記し、ユーザーに確認する）。

正本: `/.claude/rules/aws-first.md`

## 機能 → AWS 既定

| 機能 | 既定 |
|---|---|
| 認証 | Cognito（Amplify Auth） |
| データ / API | AppSync + DynamoDB（Amplify Data、`a.schema`） |
| ストレージ | S3（Amplify Storage） |
| Compute | Lambda（Amplify Functions・TS 既定） |
| 生成 AI | Bedrock（LangChain 経由） |
| キュー / イベント / ワークフロー | SQS / EventBridge / Step Functions |
| 通知 | SNS（モバイルプッシュは Pinpoint） |
| メール | SES |
| 検索 / ベクトル | OpenSearch |
| シークレット | Amplify secrets（SSM Parameter Store） |
| ホスティング / CI-CD | Amplify Hosting（`amplify.yml`） |
| 監視 | CloudWatch / X-Ray |

現在許容している外部サービスは **決済の Polar のみ**。

## 禁止

- AWS の既定サービスを検討せずに外部 SaaS を入れる
- Supabase / Vercel / Railway / Doppler / OneSignal を復活させる（意図的に排除済み）
