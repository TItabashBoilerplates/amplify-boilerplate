# `@workspace/backend` — Amplify Gen2 バックエンド

このパッケージは AWS Amplify Gen2 のバックエンド定義（Cognito / AppSync+DynamoDB / S3 / Lambda(FastAPI) / SNS）を集約する**唯一の場所**です。Amplify のモノレポ・ベストプラクティスに従い、`amplify/` フォルダを共有ワークスペースパッケージに置いています。

## 構成

```
packages/backend/
├── amplify/
│   ├── backend.ts            # defineBackend({ auth, data, storage, api, restApi, mcp }) + Lambda/SNS 配線
│   ├── auth/resource.ts      # Cognito (defineAuth, passwordless Email OTP)
│   ├── data/resource.ts      # AppSync+DynamoDB (defineData, a.schema, userPool 認可)
│   ├── storage/resource.ts   # S3 (defineStorage, 非公開・path 単位)
│   ├── functions/
│   │   ├── api/              # ★Python: FastAPI を載せた Lambda (CDK, PYTHON_3_13 + Mangum)
│   │   ├── rest-api/         # ★TypeScript(第一候補): REST API (Hono on Lambda)
│   │   │   ├── resource.ts  app.ts  handler.ts  app.test.ts
│   │   └── mcp/             # ★TypeScript: MCP サーバ (@hono/mcp + @modelcontextprotocol/sdk)
│   │       ├── resource.ts  server.ts  tools.ts  handler.ts  tools.test.ts
│   ├── package.json          # { "type": "module" }
│   └── tsconfig.json
├── index.ts                  # Schema 型の re-export（フロントの型共有）
└── package.json              # 関数の runtime 依存（hono / @hono/mcp / @modelcontextprotocol/sdk / zod / @workspace/backend-core）
```

> **TypeScript が Amplify の第一候補**: Node `defineFunction` は Amplify ネイティブ。通常の REST/MCP は
> TS 関数（`rest-api` / `mcp`）で実装する。Python の `api`（FastAPI）は重い/LLM 処理向けのエスカレーション経路。
> TS 関数の共有ロジックは `@workspace/backend-core`（`frontend/packages/backend-core`、Python の `core` 相当）。

## `backend.ts`（エントリポイント）

`defineBackend({ auth, data, storage, api })` で 4 リソースをプロビジョニングし、さらに以下を配線します:

- **FastAPI Lambda の環境変数注入**: `COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID`（`auth_middleware` の JWT 検証用）。
- **Lambda Function URL**: ブラウザ / SSR から直接呼べるよう `authType=NONE` で公開。認可は FastAPI 側の Cognito JWT 検証で行う。
- **SNS（通知基盤）**: `notifications` スタックに SNS トピックを作成し、FastAPI Lambda に publish 権限を付与（`SNS_TOPIC_ARN` を注入）。モバイルプッシュは Pinpoint を別途追加する想定。
- **`addOutput({ custom })`**: `backendApiUrl`（Function URL）と `notificationsTopicArn` を `amplify_outputs.json` の `custom` に出力。

## 各リソース

| リソース | 定義 | 概要 |
|---|---|---|
| **Auth** | `auth/resource.ts` | Cognito User Pool。`loginWith.email.otpLogin: true`（passwordless Email OTP）。クライアントは `aws-amplify/auth`、サーバーは `runWithAmplifyServerContext` + `aws-amplify/auth/server`。認証ユーティリティは `@workspace/auth`。 |
| **Data** | `data/resource.ts` | AppSync + DynamoDB。`a.schema(...)` でコードファースト定義、既定認可モードは `userPool`。`a.model(...).authorization((allow) => [allow.owner()])` の認可ルールが RLS を置き換える。 |
| **Storage** | `storage/resource.ts` | S3。非公開・path 単位アクセス（例: `media/{entity_id}/*` は `allow.entity('identity')`）。 |
| **restApi (TS/Hono Lambda)** | `functions/rest-api/` | **Amplify ネイティブの第一候補**。Node `defineFunction`。`app.ts`(Hono) を `hono/aws-lambda` で Lambda 化。`app.request()` で単体テスト可。Function URL 公開、Cognito JWT 検証想定（env 注入）。 |
| **mcp (TS MCP Lambda)** | `functions/mcp/` | Node `defineFunction`。`@hono/mcp` の `StreamableHTTPTransport` + `@modelcontextprotocol/sdk` の `McpServer`。tools(`ping`/`add`/`generate`)は `tools.ts` に純粋関数で切り出してテスト。`/mcp` を Function URL 公開。 |
| **api (FastAPI Lambda)** | `functions/api/resource.ts` | Python のエスカレーション経路。CDK `Function`(PYTHON_3_13)。`backend-py`（uv workspace）をバンドルし `api.lambda_handler.handler`（Mangum）で FastAPI を Lambda に適合。 |

## ローカル開発（Supabase ローカル + Docker の代替）

AWS 認証情報（プロファイル）を設定済みであることが前提です。

```bash
cd frontend/packages/backend

# per-developer のクラウド sandbox を起動（ファイル監視で自動再デプロイ）
bun run sandbox          # = ampx sandbox

# 1回だけデプロイして終了（CI/検証向け）
bun run sandbox:once     # = ampx sandbox --once

# 破棄
bun run sandbox:delete
```

> リポジトリルートの devenv scripts `sandbox` / `sandbox-once` / `sandbox-delete` からも実行できます（正典: `/.claude/rules/commands.md`）。

`ampx sandbox` は **`amplify_outputs.json`**（エンドポイント・認証フロー情報・`custom` 出力など）を生成します。フロントエンドはこのファイルで `Amplify.configure()` します。`amplify_outputs.json` は **git 管理しません**（`.gitignore` 済み・環境ごとに生成）。

> 💡 `functions/api/` の Python Lambda をバンドルするため、ローカルに `uv` と `python3`（または Docker）が必要です。

## シークレット（Amplify secrets）

シークレットは **Amplify secrets（SSM Parameter Store）** で管理します（Doppler の置き換え）。

```bash
# sandbox にシークレットを設定
ampx sandbox secret set GOOGLE_CLIENT_SECRET

# resource.ts から参照
# import { secret } from '@aws-amplify/backend'
# clientSecret: secret('GOOGLE_CLIENT_SECRET')
```

## フロントエンドからの型共有・データアクセス

型は `@workspace/backend` から共有し、データクライアントは `@workspace/data-client` の `getDataClient()`（`generateClient<Schema>()` のラッパー）を使います。

```ts
import type { Schema } from '@workspace/backend'
import { getDataClient } from '@workspace/data-client'

const { data: todos } = await getDataClient().models.Todo.list()
```

## デプロイ（CI/CD）

Amplify Hosting（monorepo, `appRoot=frontend`）が `amplify.yml` に従い、backend を `ampx pipeline-deploy` でデプロイし、Next.js をビルドします。

```bash
ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
```

ブランチ / 本番デプロイは Amplify Hosting が実行します。CI（`.github/workflows/ci.yml`）は lint / format / type-check / test を担当します。
