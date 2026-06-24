# Amplify Gen2 Functions (AWS Lambda)

backend の関数は `frontend/packages/backend/amplify/functions/` に置く。Node/TypeScript の関数は
`defineFunction`（第一級サポート）。**Python（FastAPI + Mangum）は CDK に降りた custom function** で
定義する — 本リポジトリの `functions/api/resource.ts` がその実体。

バージョン: `@aws-amplify/backend` ^1.23 / `aws-amplify` ^6.18 / `aws-cdk-lib` ^2.234。

## 目次

- [Node defineFunction（TS）](#node-definefunctionts)
  - [設定オプション](#設定オプション)
  - [環境変数と secret()](#環境変数と-secret)
- [他リソースへのアクセス付与](#他リソースへのアクセス付与)
  - [access プロパティ](#access-プロパティ)
  - [CDK で execution role を拡張](#cdk-で-execution-role-を拡張)
  - [Data リゾルバとして使う](#data-リゾルバとして使う)
- [スケジュール実行（cron / rate）](#スケジュール実行cron--rate)
- [Auth トリガー](#auth-トリガー)
- [Custom（Python）function via CDK ★本リポジトリの規約](#custompython-function-via-cdk-本リポジトリの規約)
  - [resource.ts のパターン](#resourcets-のパターン)
  - [backend.ts で env / Function URL を配線](#backendts-で-env--function-url-を配線)
  - [Gotchas](#gotchas)

---

## Node defineFunction（TS）

```typescript
// amplify/functions/say-hello/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const sayHello = defineFunction({
  name: 'say-hello',      // 省略時はディレクトリ名
  entry: './handler.ts',  // 省略時は ./handler.ts
})
```

ハンドラは **必ず `handler` という名前で export**:

```typescript
// amplify/functions/say-hello/handler.ts
import type { Handler } from 'aws-lambda'

export const handler: Handler = async (event, context) => {
  return 'Hello, World!'
}
```

`backend.ts` で登録:

```typescript
import { defineBackend } from '@aws-amplify/backend'
import { sayHello } from './functions/say-hello/resource'

defineBackend({ sayHello })
```

### 設定オプション

| オプション | 既定 | 範囲・説明 |
| --- | --- | --- |
| `timeoutSeconds` | `3` | 1 秒〜15 分 |
| `memoryMB` | `512` | 128〜10240 MB |
| `ephemeralStorageSizeMB` | `512` | 512〜10240 MB |
| `runtime` | `18` | **Node のみ**（`defineFunction` は Node ランタイムのみ対応）。例 `20` |
| `entry` | `./handler.ts` | ハンドラファイル |
| `name` | ディレクトリ名 | 明示名 |
| `environment` | — | 環境変数（下記） |
| `schedule` | — | cron / rate（下記） |
| `resourceGroupName` | — | 関連リソースとグループ化（例 `'data'` / `'auth'`） |

```typescript
export const heavyFn = defineFunction({
  name: 'heavy-fn',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 1024,
  resourceGroupName: 'data',
})
```

> これらのオプションは **custom function（CDK 形式）では `resourceGroupName` を除き効かない**。
> custom function 側では CDK の `Function` プロパティ（`timeout` / `memorySize` / `runtime` …）で設定する。

### 環境変数と secret()

平文の環境変数は `environment`。**機密値は `secret()`** を使う（平文ではビルド成果物に出る）。

```typescript
import { defineFunction, secret } from '@aws-amplify/backend'

export const sayHello = defineFunction({
  name: 'say-hello',
  environment: {
    NAME: 'World',
    API_ENDPOINT: process.env.API_ENDPOINT ?? '',
    API_KEY: secret('MY_API_KEY'), // SSM Parameter Store から実行時に取得
  },
})
```

ハンドラからは生成される型付き `env` で参照（`$amplify/env/<function-name>`）:

```typescript
import { env } from '$amplify/env/say-hello'

export const handler = async () => {
  const auth = `Bearer ${env.API_KEY}` // secret は実行時にメモリへ供給される
  return `Hello, ${env.NAME}! (${env.API_ENDPOINT})`
}
```

secret の登録（devenv 経由で sandbox を起動している前提。AWS 認証情報が必要）:

```bash
# 値は ampx の secret コマンドで SSM に登録する
ampx sandbox secret set MY_API_KEY
```

---

## 他リソースへのアクセス付与

### access プロパティ

リソース定義側で「自然言語」で許可を宣言する。許可すると型付き環境変数が関数に注入される。

```typescript
// storage 側で関数に CRUD を許可
import { defineStorage } from '@aws-amplify/backend'
import { generateReports } from '../functions/generate-reports/resource'

export const storage = defineStorage({
  name: 'myReports',
  access: (allow) => ({
    'reports/*': [allow.resource(generateReports).to(['read', 'write', 'delete'])],
  }),
})
```

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from '$amplify/env/generate-reports'

const s3 = new S3Client()
export const handler = async () => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.MY_REPORTS_BUCKET_NAME, // access 付与で注入される
      Key: `reports/${new Date().toISOString()}.csv`,
      Body: new Blob([''], { type: 'text/csv;charset=utf-8;' }),
    })
  )
}
```

### CDK で execution role を拡張

`access` で足りない権限は `backend.<fn>.resources.lambda` から CDK で付与する。

```typescript
import { defineBackend } from '@aws-amplify/backend'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sns from 'aws-cdk-lib/aws-sns'
import { weeklyDigest } from './functions/weekly-digest/resource'

const backend = defineBackend({ weeklyDigest })
const lambda = backend.weeklyDigest.resources.lambda

const stack = backend.createStack('WeeklyDigest')
const topic = new sns.Topic(stack, 'Topic')

// 1) PolicyStatement を直接追加
lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sns:Publish'],
    resources: [topic.topicArn],
  })
)
// 2) もしくは grant ヘルパ
topic.grantPublish(lambda)
```

本リポジトリの `backend.ts` でも FastAPI Lambda に対してこのパターンで SNS publish 権限を付与している
（`notificationsTopic.grantPublish(fastapi)`）。

### Data リゾルバとして使う

関数を AppSync のカスタムクエリ／ミューテーションのハンドラに紐づける（`amplify/data/resource.ts`）:

```typescript
import { a, defineData } from '@aws-amplify/backend'
import { sayHello } from '../functions/say-hello/resource'

const schema = a.schema({
  sayHello: a
    .query()
    .arguments({ name: a.string() })
    .returns(a.string())
    .handler(a.handler.function(sayHello))
    .authorization((allow) => [allow.authenticated()]),
})

export const data = defineData({ schema })
```

---

## スケジュール実行（cron / rate）

`schedule` に自然言語 / cron を渡す（裏は EventBridge ルール）。**custom function では非対応** —
CDK 側で `aws-cdk-lib/aws-events` の Rule を組む。

```typescript
export const weeklyDigest = defineFunction({
  name: 'weekly-digest',
  schedule: 'every week',
  // schedule: 'every 1h' | 'every 2m' | 'every day' | 'every month'
  // schedule: '0 9 ? * 3 *'              // 毎週火曜 9:00（cron）
  // schedule: ['every week', '0 17 ? * 5 *'] // 複数指定も可
})
```

ハンドラは `EventBridgeHandler`:

```typescript
import type { EventBridgeHandler } from 'aws-lambda'

export const handler: EventBridgeHandler<'Scheduled Event', null, void> = async (event) => {
  console.log('scheduled', JSON.stringify(event))
}
```

自然言語: `every day`（深夜0時）/ `every week`（日曜0時）/ `every month` / `every year` /
`every <n>m`（分）/ `every <n>h`（時）。

---

## Auth トリガー

Cognito のトリガーは `defineAuth({ triggers })` に `defineFunction` を渡す
（`amplify/auth/resource.ts`）。

```typescript
import { defineAuth, defineFunction } from '@aws-amplify/backend'

export const preSignUp = defineFunction({ name: 'pre-sign-up' })

export const auth = defineAuth({
  loginWith: { email: true },
  triggers: {
    preSignUp,            // サインアップ前（ドメイン許可/拒否など）
    // postConfirmation,  // 確認後（グループ追加 / プロフィール作成など）
    // preTokenGeneration // トークン生成前（クレーム上書き）
  },
})
```

代表的なトリガーハンドラ型: `PreSignUpTriggerHandler` / `PostConfirmationTriggerHandler` /
`PreTokenGenerationTriggerHandler`（`aws-lambda` から）。

```typescript
import type { PreSignUpTriggerHandler } from 'aws-lambda'

export const handler: PreSignUpTriggerHandler = async (event) => {
  const email = event.request.userAttributes.email
  if (!email?.endsWith('@example.com')) {
    throw new Error('Invalid email domain')
  }
  return event
}
```

> 公式 examples ページにはこのほか「post auth でグループ追加」「user profile レコード作成」
> 「custom message」「reCAPTCHA challenge」「DynamoDB / Kinesis ストリーム」「S3 upload 確認」等がある。

---

## Custom（Python）function via CDK ★本リポジトリの規約

`defineFunction` は Node/TS のみ第一級サポートのため、Python（FastAPI on Lambda）は
`defineFunction((scope) => new Function(...))` の **scope コールバック形式**で CDK の `Function` を
直接定義する。本リポジトリの `functions/api/resource.ts` が実体。

ハンドラは `api.lambda_handler.handler`（Mangum が FastAPI を Lambda に適合）。

### resource.ts のパターン

```typescript
// amplify/functions/api/resource.ts
import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineFunction } from '@aws-amplify/backend'
import { DockerImage, Duration } from 'aws-cdk-lib'
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'

const functionDir = path.dirname(fileURLToPath(import.meta.url))
// repo root の backend-py（uv workspace）への相対パス
const backendPyDir = path.resolve(functionDir, '../../../../../../backend-py')

export const api = defineFunction(
  (scope) =>
    new Function(scope, 'fastapi', {
      handler: 'api.lambda_handler.handler',
      runtime: Runtime.PYTHON_3_13,
      timeout: Duration.seconds(30),
      memorySize: 512,
      code: Code.fromAsset(backendPyDir, {
        bundling: {
          // Docker フォールバック用イメージ
          image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.13'),
          // ローカルに uv + python3 があれば Docker 無しでバンドル
          local: {
            tryBundle(outputDir: string) {
              const reqFile = path.join(outputDir, 'requirements.txt')
              // 1) サードパーティ依存だけ requirements.txt に書き出す（workspace 除外）
              execSync(
                `uv export --frozen --no-dev --no-emit-workspace --package api -o ${reqFile}`,
                { cwd: backendPyDir, stdio: 'inherit' }
              )
              // 2) Lambda(linux/x86_64) 互換 wheel をインストール
              execSync(
                `python3 -m pip install -r ${reqFile} -t ${outputDir} ` +
                  '--platform manylinux2014_x86_64 --python-version 3.13 --only-binary=:all:',
                { stdio: 'inherit' }
              )
              // 3) アプリ + 共有パッケージのソースをコピー
              execSync(
                `cp -r ${path.join(backendPyDir, 'apps/api/src/api')} ${outputDir}/api`,
                { stdio: 'inherit' }
              )
              execSync(
                `cp -r ${path.join(backendPyDir, 'packages/core/src/core')} ${outputDir}/core`,
                { stdio: 'inherit' }
              )
              return true
            },
          },
        },
      }),
    }),
  {
    resourceGroupName: 'auth', // custom function で有効なのは resourceGroupName のみ
  }
)
```

ポイント:

- **scope コールバック形式**: `defineFunction((scope) => new Function(scope, 'id', {...}), { resourceGroupName })`。
- `Runtime.PYTHON_3_13`、`timeout` は `Duration.seconds()`、`memorySize` は MB 数。
- `Code.fromAsset(dir, { bundling })` で `dir` をバンドル。`bundling.local.tryBundle` が `true` を
  返せば **Docker を使わずローカル** で完結（uv export → pip install → ソースコピー）。失敗時のみ
  `bundling.image` の Docker にフォールバック。
- `--platform manylinux2014_x86_64 --only-binary=:all:` で Lambda 互換 wheel を取得（ネイティブ拡張対策）。
- `resourceGroupName` 以外の `defineFunction` オプション（`environment` / `schedule` / `timeoutSeconds` 等）は
  **custom function では効かない**。env は backend.ts で `addEnvironment` する。

### backend.ts で env / Function URL を配線

```typescript
// amplify/backend.ts（抜粋）
import { defineBackend } from '@aws-amplify/backend'
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda'
import { auth } from './auth/resource'
import { api } from './functions/api/resource'

const backend = defineBackend({ auth, data, storage, api })

const fastapi = backend.api.resources.lambda
const { userPool, userPoolClient } = backend.auth.resources

// Cognito 検証用の値を env で注入（FastAPI の auth_middleware が参照）
fastapi.addEnvironment('COGNITO_USER_POOL_ID', userPool.userPoolId)
fastapi.addEnvironment('COGNITO_APP_CLIENT_ID', userPoolClient.userPoolClientId)

// ブラウザ/SSR から直接呼べる Lambda Function URL を公開
// 認可は FastAPI 側の Cognito JWT 検証で行うため authType=NONE
const apiUrl = fastapi.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.ALL],
    allowedHeaders: ['*'],
  },
})

// フロントが参照できるよう amplify_outputs.json の custom に出力
backend.addOutput({
  custom: { backendApiUrl: apiUrl.url },
})
```

要点:

- `backend.<fn>.resources.lambda` で CDK の `IFunction` を取得 → `addEnvironment(key, value)` で env、
  `addFunctionUrl({...})` で Function URL を付与。
- 追加 IAM 権限は `lambda.addToRolePolicy(...)` または `<resource>.grant*(lambda)`（本リポジトリは
  `notificationsTopic.grantPublish(fastapi)`）。
- フロントへ渡したい値は `backend.addOutput({ custom: {...} })` で `amplify_outputs.json` に出力。

### Gotchas

- **オプション非対応**: custom function は `environment` / `schedule` / Lambda layers /
  `timeoutSeconds` 等の `defineFunction` オプションを受け付けない（`resourceGroupName` のみ）。
  すべて CDK の `Function` プロパティ／`backend.ts` 側で設定する。
- **バンドルに Docker かローカルツールが必要**: `tryBundle` でローカル（uv + python3 + pip）が無いと
  Docker（`public.ecr.aws/sam/build-python3.13`）にフォールバックする。CI/ローカルで uv・python3 を
  用意しておく。
- **コールドスタート**: FastAPI + 依存を載せた Python Lambda は初回起動が遅い。`memorySize` を上げる、
  常時アクセスがあるなら Provisioned Concurrency を検討。
- **Function URL の認可**: `authType: NONE` は誰でも叩ける。必ず FastAPI 側で Cognito JWT を検証する
  （`auth_middleware`）。検証を外すと無防備になる。
- **依存の解決**: `uv export --no-emit-workspace` で workspace 内パッケージを除外し、サードパーティ
  依存だけ wheel 化。workspace パッケージ（`apps/api` / `packages/core`）はソースを直接コピーする。
