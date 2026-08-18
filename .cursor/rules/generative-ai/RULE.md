---
description: "Generative AI patterns: SSE for interactive, worker Lambda for <=15min, Bedrock AgentCore beyond that"
alwaysApply: false
globs: ["frontend/packages/backend/amplify/functions/**/*.ts", "backend-py/**/*.py"]
---
# Generative AI

正本: `/.claude/rules/generative-ai.md`

| 種類 | 実装パターン |
|---|---|
| 対話的・短時間（チャット / 補完 / 要約） | **SSE ストリーミング**（Hono `streamSSE` + Function URL `RESPONSE_STREAM`） |
| 背景処理・〜15 分・サンドボックス不要 | **ワーカー Lambda + DB ステータス + AppSync サブスクリプション** |
| 15 分超 or サンドボックス隔離が必要 | **Amazon Bedrock AgentCore**（Runtime 最大 8 時間 / Code Interpreter / Browser） |

- LLM クライアントは **LangChain**（TS=`@langchain/aws`、Python=`langchain-aws`）
- 監視は **AppSync サブスクリプション**。**ポーリングしない**
- ジョブの読み取りは owner 認可、**ワーカーの書き込みは IAM / ロール**
- **トークン使用量とコストの計測を最初から設計に含める**（使用量イベントは遡って作れない）
