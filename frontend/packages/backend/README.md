# `@workspace/backend` — Amplify Gen2 バックエンド

このパッケージは AWS Amplify Gen2 のバックエンド定義（Cognito / AppSync+DynamoDB / S3、後続で Lambda）を集約する**唯一の場所**です。Amplify のモノレポ・ベストプラクティスに従い、`amplify/` フォルダを共有ワークスペースパッケージに置いています。

## 構成

```
packages/backend/
├── amplify/
│   ├── backend.ts            # defineBackend エントリポイント
│   ├── auth/resource.ts      # Cognito (defineAuth)        ← Supabase Auth の置換
│   ├── data/resource.ts      # AppSync+DynamoDB (defineData) ← Supabase Postgres/Drizzle の置換
│   ├── storage/resource.ts   # S3 (defineStorage)          ← Supabase Storage の置換
│   ├── package.json          # { "type": "module" }
│   └── tsconfig.json
├── index.ts                  # Schema 型の re-export（フロントの型共有）
└── package.json
```

> 後続フェーズで `amplify/functions/`（FastAPI を載せた Python Lambda など）を追加します。

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

`ampx sandbox` は **`amplify_outputs.json`**（エンドポイント・公開キー・認証フロー情報）を生成します。フロントエンドはこのファイルで `Amplify.configure()` します。`amplify_outputs.json` は **git 管理しません**（`.gitignore` 済み・環境ごとに生成）。

## フロントエンドからの型共有

```ts
import type { Schema } from '@workspace/backend'
import { generateClient } from 'aws-amplify/data'

const client = generateClient<Schema>()
```

## デプロイ（CI/CD）

Amplify Hosting のビルドで、backend アプリが次を実行します:

```bash
ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
```

フロントエンドアプリ側は backend の出力を取得します:

```bash
ampx generate outputs --branch <branch> --app-id <backend-app-id>
```

詳細な CI/CD・`amplify.yml` は Phase 11 で整備します。
