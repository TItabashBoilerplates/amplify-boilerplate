# Amplify Gen2 Backend 合成・カスタム CDK・デプロイ

`defineBackend` でリソース（auth/data/storage/api）を合成し、CDK で拡張し、
secrets / env を流し込み、`ampx sandbox`（ローカル）/ `ampx pipeline-deploy`（CI）で
デプロイするまでの正典。backend 定義は共有ワークスペース `@workspace/backend`
（`frontend/packages/backend/amplify/`）に集約する（Amplify モノレポ・ベストプラクティス）。

バージョン: `@aws-amplify/backend` ^1.23 / `@aws-amplify/backend-cli`（`ampx`）^1.8.3 /
`aws-amplify` ^6.18 / `aws-cdk-lib` ^2.234。

> コマンドは必ず devenv scripts（`sandbox` / `sandbox-once` / `sandbox-delete` = `ampx`）で
> 実行する。`bunx ampx ...` の直叩きは `.claude/rules/commands.md` で禁止。

## 目次

- [1. defineBackend：リソース合成と backend オブジェクト](#1-definebackendリソース合成と-backend-オブジェクト)
- [2. カスタム CDK で拡張する](#2-カスタム-cdk-で拡張する)
- [3. Secrets と環境変数](#3-secrets-と環境変数)
- [4. ローカル開発（ampx sandbox）](#4-ローカル開発ampx-sandbox)
- [5. outputs / client code の生成](#5-outputs--client-code-の生成)
- [6. CI/CD とホスティング（amplify.yml）](#6-cicd-とホスティングamplifyyml)
- [7. Next.js 配線（SSR）の要点](#7-nextjs-配線ssrの要点)
- [8. 落とし穴](#8-落とし穴)

---

## 1. defineBackend：リソース合成と backend オブジェクト

`defineBackend({ ... })` に各リソース定義（`defineAuth` / `defineData` / `defineStorage` /
`defineFunction`）を渡すと、CDK で合成された `backend` オブジェクトが返る。
本リポジトリのエントリポイントは `frontend/packages/backend/amplify/backend.ts`。

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { api } from './functions/api/resource' // FastAPI を載せた Python Lambda

const backend = defineBackend({
  auth,
  data,
  storage,
  api,
})
```

`backend.<key>.resources.*` で、各リソースが生成した CDK / CloudFormation 構造体に到達できる。
`<key>` は `defineBackend` に渡したキー（`auth` / `data` / `storage` / `api`）。

```typescript
// L2 construct（高レベル）に到達
const { userPool, userPoolClient } = backend.auth.resources       // Cognito
const fastapi = backend.api.resources.lambda                       // lambda.Function
const table = backend.data.resources.tables['Todo']                // DynamoDB Table
const bucket = backend.storage.resources.bucket                    // s3.Bucket

// CloudFormation（L1 / cfn）リソースに到達して低レベル property を上書き
const { cfnUserPool } = backend.auth.resources.cfnResources
cfnUserPool.deletionProtection = 'ACTIVE'
```

本リポジトリでは、合成した Lambda（FastAPI）に環境変数を注入し Function URL を公開する：

```typescript
const fastapi = backend.api.resources.lambda
const { userPool, userPoolClient } = backend.auth.resources

// Cognito JWT 検証（auth_middleware）に必要な値を env で注入
fastapi.addEnvironment('COGNITO_USER_POOL_ID', userPool.userPoolId)
fastapi.addEnvironment('COGNITO_APP_CLIENT_ID', userPoolClient.userPoolClientId)

// ブラウザ/SSR から直接呼べる Lambda Function URL（認可は FastAPI 側の Cognito 検証）
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda'
const apiUrl = fastapi.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: { allowedOrigins: ['*'], allowedMethods: [HttpMethod.ALL], allowedHeaders: ['*'] },
})
```

---

## 2. カスタム CDK で拡張する

Amplify が管理しない AWS リソースは、`backend.createStack('name')` で**独立した
ネストスタック**を作り、その中で任意の CDK construct を `new` する。
複数スタック・1 スタック複数リソースのどちらも可能。

```typescript
import { Topic } from 'aws-cdk-lib/aws-sns'

// 通知（SNS）：サーバー駆動の通知基盤。FastAPI Lambda に publish 権限を付与
const notificationsStack = backend.createStack('notifications')
const notificationsTopic = new Topic(notificationsStack, 'NotificationsTopic')
notificationsTopic.grantPublish(fastapi)              // IAM 権限付与（CDK grant API）
fastapi.addEnvironment('SNS_TOPIC_ARN', notificationsTopic.topicArn)
```

`backend.addOutput({ custom: {...} })` で、生成した値を `amplify_outputs.json` の
**`custom` キー**に出力する。フロントエンドはここから FastAPI の Function URL などを読む。

```typescript
backend.addOutput({
  custom: {
    backendApiUrl: apiUrl.url,                        // → outputs.custom.backendApiUrl
    notificationsTopicArn: notificationsTopic.topicArn,
  },
})
```

> `grantPublish` / `grantRead` 等の CDK grant API は、対象（ここでは Lambda の実行ロール）に
> 最小権限の IAM ポリシーを自動付与する。手書きの IAM ステートメントより安全。
> 大きめのカスタム construct は `Construct` を継承したクラスに切り出し、
> `new MyConstruct(backend.createStack('X'), 'X', props)` の形で配置するのが公式パターン。

---

## 3. Secrets と環境変数

機密値はリソース定義内で `secret('NAME')`（SSM Parameter Store から実行時解決）、非機密値は
function の `environment` / `addEnvironment`、フロントは `amplify_outputs.json`（backend 由来）
+ `NEXT_PUBLIC_*`（公開値）で扱う。

```typescript
import { secret } from '@aws-amplify/backend'
// 例: 機密は secret()、非機密は addEnvironment（合成後の値を注入）
clientSecret: secret('GOOGLE_CLIENT_SECRET')
fastapi.addEnvironment('SNS_TOPIC_ARN', notificationsTopic.topicArn)
```

```bash
bunx ampx sandbox secret set GOOGLE_CLIENT_ID   # sandbox（SSM・コンソール非表示）
# ブランチは Amplify コンソール Hosting → Secrets で設定
```

→ secrets vs env の使い分け、`ampx sandbox secret` 全コマンド、ブランチ secret の SSM パス、
function の型付き `env`（`$amplify/env/<fn>`）/ `secret()`、Python Lambda の `os.getenv`、
`NEXT_PUBLIC_*` / `amplify_outputs.json` / dotenvx の詳細は
[secrets-and-env.md](secrets-and-env.md) を参照。

---

## 4. ローカル開発（ampx sandbox）

`ampx sandbox` は**開発者ごとのクラウド sandbox**にデプロイし、ファイル変更を watch して
差分を反映し、`amplify_outputs.json` を生成する（Supabase ローカル Docker の代替）。
**AWS 認証情報（プロファイル）が必須。**

| 操作 | devenv script | 実体 |
|---|---|---|
| watch 起動（outputs 生成） | `sandbox` | `ampx sandbox` |
| 1 回デプロイして終了 | `sandbox-once` | `ampx sandbox --once` |
| sandbox 破棄 | `sandbox-delete` | `ampx sandbox delete` |

```bash
sandbox                                  # watch + amplify_outputs.json 生成
sandbox-once                             # CI 等で 1 回だけ反映
sandbox-delete                           # 破棄（-y で確認スキップ）

# 直接形式（参考）。複数 sandbox の区別や関数ログのストリーム
bunx ampx sandbox --identifier feature-x
bunx ampx sandbox --stream-function-logs
bunx ampx sandbox secret set FOO          # secret 管理（§3）
```

`--identifier` は同一アカウント内で複数 sandbox を使い分けるための名前。

---

## 5. outputs / client code の生成

CI やローカルで、デプロイ済みのブランチ環境から `amplify_outputs.json` を生成する。

```bash
# 指定ブランチ/アプリの outputs を web アプリへ生成（amplify-outputs エイリアスが解決される）
bunx ampx generate outputs --branch main --app-id <APP_ID> --out-dir ./apps/web
# --format / --outputs-version も指定可能
```

GraphQL の型・statement を生成する（必要な場合のみ。本リポジトリは `Schema` 型共有が基本）：

```bash
bunx ampx generate graphql-client-code --format typescript --out ./generated
```

> 通常、`amplify_outputs.json` は `ampx sandbox`（ローカル）と Amplify Hosting（CI、app-id+branch
> から自動）が生成する。`generate outputs` は手動再生成や別ブランチ環境の取得に使う。

---

## 6. CI/CD とホスティング（amplify.yml）

Amplify Hosting はリポジトリ root の `amplify.yml` に従う。モノレポなので
`applications[].appRoot` でフロントエンドのルート（`frontend`）を指定し、
**backend フェーズで `ampx pipeline-deploy`**、**frontend フェーズで outputs 生成 + Next.js ビルド**を行う。

```yaml
# amplify.yml（Gen2 monorepo）
version: 1
applications:
  - appRoot: frontend                       # Bun ワークスペースのルート
    backend:
      phases:
        build:
          commands:
            - npm install -g bun
            - bun install --frozen-lockfile
            # バックエンドをこのブランチにデプロイ（amplify_outputs.json 生成）
            - cd packages/backend && bunx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
    frontend:
      phases:
        preBuild:
          commands:
            - npm install -g bun
            - bun install --frozen-lockfile
            # backend 出力を web アプリへ生成（amplify-outputs エイリアスが解決）
            - cd packages/backend && bunx ampx generate outputs --branch $AWS_BRANCH --app-id $AWS_APP_ID --out-dir ../../apps/web && cd ../..
        build:
          commands:
            - bun run --filter @workspace/web build
      artifacts:
        baseDirectory: apps/web/.next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - apps/web/.next/cache/**/*
```

- **`ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`**: CI 専用の非対話デプロイ。
  `$AWS_BRANCH` / `$AWS_APP_ID` は Amplify Hosting が自動注入する。sandbox とは別物（watch しない）。
- **モノレポ接続**: Amplify コンソールでアプリ作成時に「モノレポ」チェックを有効化し、
  appRoot を `frontend` に設定する。frontend アプリは backend アプリの app-id を指して
  `generate outputs` する構成も取れる。
- **ブランチ運用 / 昇格**: `main` = 本番、`feature/*` / `dev` / `staging` = 隔離環境。
  各 Git ブランチがフルスタック環境に 1:1 対応する。コンソールで「ブランチ自動検出/自動切断」を
  有効化すると `feature/*` 等のパターンで自動接続/削除できる。昇格は PR を `main` にマージ →
  `main` のビルドが走り変更リソースのみ更新、という通常の Git フローで行う。

---

## 7. Next.js 配線（SSR）の要点

サーバー側は `createServerRunner({ config: outputs })` の `runWithAmplifyServerContext` を使い、
クライアント側は root layout で `Amplify.configure(outputs, { ssr: true })` を実行する。
本リポジトリでは server util を `apps/web/src/shared/lib/amplify/server` に置く。

```typescript
// shared/lib/amplify/server.ts（サーバー）
import { createServerRunner } from '@aws-amplify/adapter-nextjs'
import outputs from 'amplify-outputs'

export const { runWithAmplifyServerContext } = createServerRunner({ config: outputs })
```

```typescript
// shared/lib/amplify/ConfigureAmplifyClientSide.tsx（クライアント）
'use client'
import { Amplify } from 'aws-amplify'
import outputs from 'amplify-outputs'

Amplify.configure(outputs, { ssr: true })  // ssr:true でトークンを Cookie に保存

export default function ConfigureAmplifyClientSide() {
  return null
}
```

```typescript
// app/layout.tsx（root layout で 1 回マウント）
import ConfigureAmplifyClientSide from '@/shared/lib/amplify/ConfigureAmplifyClientSide'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ConfigureAmplifyClientSide />
        {children}
      </body>
    </html>
  )
}
```

Server Component / Server Action での認証チェックは `runWithAmplifyServerContext` 経由
（詳細は `frontend/CLAUDE.md` の Amplify セクション）。

---

## 8. 落とし穴

- **`amplify_outputs.json` は生成物 & gitignore**。fresh clone 直後は存在しないため、
  `amplify-outputs` を import するコードは `sandbox`（または `ampx generate outputs`）を
  一度走らせるまで**型チェックが通らない**。CI では frontend preBuild の `generate outputs` で解決。
- **custom outputs の型付け**: `addOutput({ custom })` の値は `amplify_outputs.json` の
  `custom` に入るが、自動で厳密な型は付かない。`outputs.custom.backendApiUrl` を使う側で
  必要なら型アサーション/ラッパーを用意する。
- **sandbox identifier の衝突**: 同一アカウントで複数 sandbox を併用するなら
  `--identifier` で区別する。未指定だと既定 sandbox に上書きデプロイされる。
- **`pipeline-deploy` は CI 専用 / 非対話**。手元で叩かない（ローカルは `sandbox`）。
  `$AWS_BRANCH` / `$AWS_APP_ID` が無い環境では失敗する。
- **`backend.<key>.resources` のキーは `defineBackend` の引数キー**。本リポジトリでは
  Lambda は `api`（`backend.api.resources.lambda`）。リネーム時は backend.ts の参照も追従させる。
- **AWS 認証情報必須**: `sandbox` / デプロイ系はすべて AWS プロファイルが要る。未設定だと即失敗。
