# AWS-First Policy

**MANDATORY / NON-NEGOTIABLE**: 必要な機能は原則 **AWS エコシステム内**で賄う。外部サービスを
使うのは **AWS では要件的に実現が難しい場合に限る**（実際にはほぼ無い想定）。

このボイラープレートは Supabase / Vercel / Railway / Doppler / OneSignal 等の外部 SaaS を
**意図的に排除し、すべて AWS / Amplify に統一**した。新規機能でこの原則を崩さない。

## 1. 機能 → AWS 既定マッピング

新しい機能が要るときは、まず下表の **AWS 既定**を使う。外部 SaaS をデフォルトで入れない。

| 機能 | AWS 既定 | 備考 |
|---|---|---|
| 認証 | **Cognito**（Amplify Auth） | passwordless Email OTP |
| データ / API | **AppSync + DynamoDB**（Amplify Data） | `a.schema` / リアルタイムは subscription |
| リレーショナル DB が要る場合 | **Aurora / RDS**（+ Amplify Data SQL） | DynamoDB で表現困難な強整合・複雑 JOIN のみ |
| ストレージ | **S3**（Amplify Storage） | |
| Compute（API/関数） | **Lambda**（Amplify Functions, TS 既定） | `.claude/rules/backend-architecture.md` |
| 長時間/サンドボックスのエージェント | **Bedrock AgentCore** | `.claude/rules/generative-ai.md` |
| 生成 AI / LLM | **Bedrock**（LangChain 経由） | `references/generative-ai.md` |
| キュー / 非同期 | **SQS** | `references/aws-services.md` |
| イベント | **EventBridge** | |
| ワークフロー | **Step Functions** | |
| 通知（サーバー） | **SNS** | |
| モバイルプッシュ | **Pinpoint / AWS End User Messaging** | |
| メール送信 | **SES** | |
| 全文検索 / ベクトル | **OpenSearch**（Service / Serverless） | |
| シークレット | **SSM Parameter Store / Amplify secrets** | `references/secrets-and-env.md` |
| ホスティング / CI-CD | **Amplify Hosting** | `amplify.yml` |
| 監視 / ログ | **CloudWatch / X-Ray** | |
| CDN | **CloudFront** | Amplify Hosting に内包 |

> 表に無い機能でも、まず AWS のサービスを探す（`references/aws-services.md` の統合パターンで配線）。

## 2. 外部サービスを使ってよい条件（例外）

以下を**すべて満たす場合のみ**外部 SaaS を採用してよい:

1. **AWS に同等機能が無い／要件的に明確に厳しい**（機能・SLA・コスト・法令等の具体的な理由がある）。
2. 採用理由（なぜ AWS では不可か）を **コード / PR / ドキュメントに明記**する。
3. **ユーザーに確認**してから入れる（`.claude/rules/feedback_ask_user_when_unsure.md`）。

> 「慣れているから」「サンプルが多いから」は理由にならない。**AWS で実現できるなら AWS を使う。**

## 3. 現在許容している外部サービス

| サービス | 用途 | 理由 |
|---|---|---|
| **Polar** | 決済 / サブスク | AWS に同等の決済プラットフォーム製品が無いため維持（インフラ非依存） |

> 新たに外部サービスを足すときは、この表に**理由付きで追記**する。理由が書けないなら採用しない。

## 4. 強制事項

- 機能追加で **AWS の既定サービスを検討せずに外部 SaaS を入れた**場合はやり直し。
- 外部 SaaS を入れるなら **§2 の3条件（AWS不可の理由・明記・ユーザー確認）**を満たすこと。
- 関連: `.claude/rules/backend-architecture.md`（TS/Amplify 既定）/ `.claude/skills/amplify-gen2`
  （AWS 実装ガイド）/ `references/aws-services.md`（広域 AWS 統合）。
