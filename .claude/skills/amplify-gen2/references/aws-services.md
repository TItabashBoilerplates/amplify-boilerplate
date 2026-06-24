# Amplify Gen2 × 広域 AWS サービス統合（SQS / Bedrock / EventBridge / Step Functions …）

Amplify Gen2 バックエンドに **Amplify が一級サポートしない AWS サービス**（SQS, Amazon Bedrock,
EventBridge, Step Functions, 追加の DynamoDB/S3 等）を「正しく配線」するためのガイド。
**各サービスの完全な API（Bedrock/SQS のフル仕様）は別スキルに分離する。ここでは Amplify との
継ぎ目（backend.ts での CDK・IAM 付与・イベントソース・env 注入・outputs）に集中**する。

バージョン: `@aws-amplify/backend` ^1.23 / `aws-cdk-lib` ^2.234 / `aws-amplify` ^6.18。

## 大原則（本リポジトリの規約 — 厳守）

- **AWS リソースを定義する場所は唯一 `frontend/packages/backend/amplify/` だけ**
  （`backend.ts` / `auth/` / `data/` / `storage/` / `functions/api/`）。サービス追加 = ここを編集する。
  フロントエンド（`apps/*`, `packages/*`）に AWS SDK 呼び出しを置かない。
- **これらサービスを「使う」コンピュートはサーバーサイド**: Python **FastAPI Lambda**
  （`functions/api`, boto3）か Node の `defineFunction`。フロントは SQS/Bedrock に直接触れず、
  **AppSync（Amplify Data）か FastAPI の Function URL を呼ぶ**だけ。
- `backend.ts` の既存パターン（SNS）をそのまま踏襲する:
  `backend.createStack('name')` → CDK 構築子を `new` → `grant*` / `addToRolePolicy` で IAM 付与 →
  `backend.<fn>.resources.lambda.addEnvironment(...)` で識別子注入 →
  `backend.addOutput({ custom: { ... } })` で ARN/URL を公開。

## 目次

- [1. 普遍的な統合パターン（スケルトン）](#1-普遍的な統合パターンスケルトン)
- [2. IAM / 権限付与](#2-iam--権限付与)
- [3. SQS（produce / consume）](#3-sqsproduce--consume)
- [4. Amazon Bedrock（2 つの公式経路）](#4-amazon-bedrock2-つの公式経路)
- [5. EventBridge](#5-eventbridge)
- [6. その他の構築子（簡潔）](#6-その他の構築子簡潔)
- [7. モノレポと境界](#7-モノレポと境界)
- [8. Gotchas](#8-gotchas)

---

## 1. 普遍的な統合パターン（スケルトン）

すべての「Amplify に AWS サービスを足す」作業はこの 5 ステップに集約される。
[Custom resources docs](https://docs.amplify.aws/nextjs/build-a-backend/add-aws-services/custom-resources/)。

```typescript
// frontend/packages/backend/amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { api } from './functions/api/resource'

// 0) まず defineBackend。循環参照を避けるため、追加リソースは必ず「この後」に書く
const backend = defineBackend({ auth, data, storage, api })
const fastapi = backend.api.resources.lambda // FastAPI(Python) Lambda の参照

// 1) リソース用の独立 CloudFormation スタックを切る（論理境界・命名空間）
const stack = backend.createStack('jobs')

// 2) 任意の CDK 構築子を new（このスタックに属させる）
const jobQueue = new Queue(stack, 'JobQueue')

// 3) リソース ⇄ 関数の IAM を付与（grant ヘルパ or addToRolePolicy）
jobQueue.grantSendMessages(fastapi)

// 4) 識別子を関数へ env 注入（ハンドラは os.getenv / process.env で参照）
fastapi.addEnvironment('JOB_QUEUE_URL', jobQueue.queueUrl)

// 5) ARN/URL を amplify_outputs.json の custom に公開（必要な分だけ）
backend.addOutput({
  custom: {
    jobQueueUrl: jobQueue.queueUrl,
  },
})
```

- `createStack(name)` は複数作れる。リソースは任意のスタックに置けるが、関連するものをまとめると
  デプロイ・削除の単位が明確になる（例 `'notifications'` / `'jobs'` / `'ai'`）。
- `addOutput({ custom })` の値はフロント/サーバーが `amplify_outputs.json` の `custom` から読む。
  既存例: `backend.addOutput({ custom: { backendApiUrl, notificationsTopicArn } })`。

---

## 2. IAM / 権限付与

最小権限（least-privilege）を徹底する。関数に権限を与える手段は 3 通り。

### (a) CDK の `grant*` ヘルパ（最優先・最も安全）

多くの構築子が用途別ヘルパを提供する。アクションとリソース ARN を**自動で正しく絞る**。

```typescript
queue.grantSendMessages(fastapi)     // sqs:SendMessage* をこのキューだけに
queue.grantConsumeMessages(consumer) // 受信/削除/可視性変更を付与
topic.grantPublish(fastapi)          // sns:Publish（既存の notifications で使用済み）
table.grantReadWriteData(fastapi)    // DynamoDB の read+write
bucket.grantPut(fastapi)             // S3 PutObject
```

### (b) `addToRolePolicy`（grant ヘルパが無いサービス用 — 例: Bedrock）

Bedrock のように専用 grant ヘルパが無い場合は、実行ロールに `PolicyStatement` を直接足す。

```typescript
import * as iam from 'aws-cdk-lib/aws-iam'

fastapi.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowBedrockInvoke',
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    // resources は使うモデルの ARN に絞る（'*' は避ける）
    resources: [
      `arn:aws:bedrock:${stack.region}::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0`,
    ],
  })
)
```

### (c) `defineFunction` 側の `access` プロパティ（Amplify ネイティブな資源向け）

storage/data など Amplify が管理する資源では、リソース定義側で「自然言語」で許可を宣言できる。
許可すると**型付き環境変数が関数に注入**される（バケット名など）。
[grant-access docs](https://docs.amplify.aws/nextjs/build-a-backend/functions/grant-access-to-other-resources/)。

```typescript
// storage/resource.ts — Node defineFunction に CRUD を許可
export const storage = defineStorage({
  name: 'myReports',
  access: (allow) => ({
    'reports/*': [allow.resource(generateReports).to(['read', 'write', 'delete'])],
  }),
})
// → ハンドラで env.MY_REPORTS_BUCKET_NAME が利用可能
```

> **最小権限**: `resources: ['*']` や `grant*` の対象を広げすぎない。基本は「使う ARN だけ」。
> 詳しい関数権限の説明は [functions.md](functions.md) を参照。

---

## 3. SQS（produce / consume）

非同期・バッファリング・長時間処理のオフロードに使う。Function URL（同期・最大 15 分）ではなく
キュー経由にすることでコールドスタートやタイムアウトの影響を切り離す。

### produce 側（FastAPI/Node が送信）

```typescript
// backend.ts
import { Queue } from 'aws-cdk-lib/aws-sqs'

const stack = backend.createStack('jobs')
const jobQueue = new Queue(stack, 'JobQueue')

jobQueue.grantSendMessages(fastapi)          // 送信権限
fastapi.addEnvironment('JOB_QUEUE_URL', jobQueue.queueUrl)
```

```python
# functions/api 側（boto3）— backend-py の依存に boto3 を追加しておく
import os, boto3
sqs = boto3.client("sqs")
sqs.send_message(QueueUrl=os.environ["JOB_QUEUE_URL"], MessageBody=payload)
```

### consume 側（専用 Node `defineFunction` を SQS イベントソースに紐付け）

**消費側は SQS をイベントソースにできる Node の `defineFunction` を使う**（FastAPI の Function URL は
イベントソースにできない）。

```typescript
// functions/job-worker/resource.ts
import { defineFunction } from '@aws-amplify/backend'
export const jobWorker = defineFunction({ name: 'job-worker', timeoutSeconds: 60 })
```

```typescript
// backend.ts
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { jobWorker } from './functions/job-worker/resource'

const backend = defineBackend({ auth, data, storage, api, jobWorker })
// …jobQueue を作成後…
backend.jobWorker.resources.lambda.addEventSource(new SqsEventSource(jobQueue))
// grantConsumeMessages は addEventSource が自動付与する
```

> 調整つまみ（深入りは将来の SQS スキル）: FIFO（`fifo: true` + `.fifo` 名 + `MessageGroupId`）、
> `visibilityTimeout`（consumer の timeout 以上にする）、DLQ（`deadLetterQueue: { queue, maxReceiveCount }`）。

---

## 4. Amazon Bedrock（2 つの公式経路）

> **前提（両経路共通）**: 使うリージョンで Bedrock の **Foundation Model アクセスを有効化**しておく
> （Bedrock コンソール → Model access）。未有効だと `AccessDeniedException`。
> [Set up AI docs](https://docs.amplify.aws/nextjs/ai/set-up-ai/)。

### (a) Amplify AI Kit（チャット/生成のターンキー用途に推奨）

`data/resource.ts` に AI ルートを宣言するだけで AppSync + Lambda + DynamoDB が裏で構築される。
**クライアントは AppSync 経由**（フロントは Bedrock に直接触れない）。

```typescript
// data/resource.ts
import { a, defineData } from '@aws-amplify/backend'

const schema = a.schema({
  // 多ターン・ストリーミングのチャット（owner 認可のみ対応）
  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Haiku'),
      systemPrompt: 'You are a helpful assistant.',
    })
    .authorization((allow) => allow.owner()),

  // 単発の構造化生成（owner 以外の認可: authenticated / guest / group / apiKey）
  generateRecipe: a
    .generation({
      aiModel: a.ai.model('Claude 3.5 Haiku'),
      systemPrompt: 'You generate recipes.',
    })
    .arguments({ description: a.string() })
    .returns(
      a.customType({
        name: a.string(),
        ingredients: a.string().array(),
        instructions: a.string(),
      })
    )
    .authorization((allow) => allow.authenticated()),
})
export const data = defineData({ schema })
```

```typescript
// クライアント（Web）— generations は data クライアント、conversations は UI hooks 経由
import { generateClient } from 'aws-amplify/data'
import { createAIHooks } from '@aws-amplify/ui-react-ai'
import type { Schema } from '@workspace/backend'

const client = generateClient<Schema>()
export const { useAIConversation, useAIGeneration } = createAIHooks(client)

// 単発生成
const { data, errors } = await client.generations.generateRecipe({ description })

// 多ターンチャット（hook が messages 状態と AIConversation コンポーネントを駆動）
const [{ data: { messages } }, sendMessage] = useAIConversation('chat')
```

- `a.conversation` は **owner 認可のみ**、`a.generation` は **owner 以外**（authenticated 等）という制約あり。
- `.returns()` は customType のみ（data モデルは参照不可）。
- 本リポジトリでは Amplify Data を `@workspace/data-client` / `@workspace/backend` で共有しているため、
  AI ルートも `Schema` 型に自然に乗る。

### (b) Lambda + AWS SDK（カスタムなオーケストレーション / FastAPI+LangChain に推奨）

Python/LangChain で制御したい・独自パイプラインを組みたい場合は、FastAPI Lambda に
`bedrock:InvokeModel` を付与して boto3 で `bedrock-runtime` を直接叩く。

```typescript
// backend.ts — IAM 付与（§2(b) と同じ）
import { Stack } from 'aws-cdk-lib'

fastapi.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      `arn:aws:bedrock:${Stack.of(fastapi).region}::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0`,
    ],
  })
)
```

```python
# functions/api 側（boto3 / Converse API）— backend-py 依存に boto3 を追加
import boto3
brt = boto3.client("bedrock-runtime")
resp = brt.converse(
    modelId="anthropic.claude-3-5-haiku-20241022-v1:0",
    messages=[{"role": "user", "content": [{"text": prompt}]}],
)
text = resp["output"]["message"]["content"][0]["text"]
```

> 判断指針: **チャット UI をすぐ出したい → (a) AI Kit**。
> **Python / LangChain / 独自 RAG・ツール連携の制御が要る → (b) Lambda + boto3**。
> Bedrock の完全な API（Converse のツール・ストリーミング・ガードレール等）は将来の Bedrock スキルへ。

---

## 5. EventBridge

### (a) AppSync を EventBridge バスのデータソースにする（カスタム mutation で PutEvents）

`addEventBridgeDataSource` で既存バスをデータソース登録し、カスタム mutation の resolver から
`PutEvents` する。[connect-eventbridge docs](https://docs.amplify.aws/nextjs/build-a-backend/data/custom-business-logic/connect-eventbridge-datasource/)。

```typescript
// backend.ts
import { aws_events } from 'aws-cdk-lib'

const eventStack = backend.createStack('events')
const bus = aws_events.EventBus.fromEventBusName(eventStack, 'Bus', 'default')
backend.data.addEventBridgeDataSource('EventBridgeDataSource', bus)
```

```typescript
// data/resource.ts — カスタム mutation を JS resolver で配線
publishOrder: a
  .mutation()
  .arguments({ orderId: a.id().required(), status: a.string().required() })
  .returns(a.ref('OrderStatusChange'))
  .handler(
    a.handler.custom({
      dataSource: 'EventBridgeDataSource',
      entry: './publishOrderToEventBridge.js',
    })
  )
```

```javascript
// publishOrderToEventBridge.js（APPSYNC_JS resolver）
export function request(ctx) {
  return {
    operation: 'PutEvents',
    events: [
      { source: 'amplify.orders', ['detail-type']: 'OrderStatusChange', detail: { ...ctx.args } },
    ],
  }
}
export function response(ctx) {
  return ctx.result
}
```

### (b) EventBridge ルール → Lambda（スケジュール/イベント駆動）

```typescript
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'

const rule = new Rule(stack, 'NightlyRule', { schedule: Schedule.rate(Duration.hours(24)) })
rule.addTarget(new LambdaFunction(backend.jobWorker.resources.lambda))
```

> Node 関数の単純な cron だけなら `defineFunction({ schedule: 'every day' })` で足りる（[functions.md](functions.md)）。

---

## 6. その他の構築子（簡潔）

いずれも `createStack` 内で `new` → `grant*`（無ければ `addToRolePolicy`）→ env 注入 → outputs、の同一型。
深い API は**各サービスの専用スキル（将来追加）**に委ねる。

- **追加 DynamoDB テーブル**:
  `new dynamodb.Table(stack, 'Aux', { partitionKey })` → `table.grantReadWriteData(fastapi)` →
  `fastapi.addEnvironment('AUX_TABLE_NAME', table.tableName)`。
  既存テーブルは `dynamodb.Table.fromTableName(stack, 'Ext', 'name')` で参照。
  （ユーザーデータは原則 Amplify Data の `a.model` を使う。これは横断ジョブ/集計用の補助テーブル向け。）
- **追加 S3 バケット**:
  `new s3.Bucket(stack, 'Assets')` → `bucket.grantReadWrite(fastapi)` → env で `tableName`/`bucketName`。
  ユーザー向けの保存は `defineStorage`（[storage.md](storage.md)）を優先。
- **Step Functions**:
  `new sfn.StateMachine(stack, 'Flow', { definitionBody })` → `sm.grantStartExecution(fastapi)` →
  `fastapi.addEnvironment('STATE_MACHINE_ARN', sm.stateMachineArn)`。長時間・多段オーケストレーション用。
- **EventBridge Scheduler / 既存リソース参照**:
  ARN ベースで `*.fromXxxArn(stack, id, arn)` を使い、grant して関数に注入。

---

## 7. モノレポと境界

```
frontend/packages/backend/amplify/   ← AWS リソース定義は「ここだけ」
├── backend.ts        # defineBackend + createStack で CDK 構築子・IAM・env・outputs を配線
├── data/resource.ts  # AppSync。AI ルート(a.conversation/a.generation)・EventBridge mutation もここ
├── functions/api/    # FastAPI(Python) Lambda — boto3 で SQS/Bedrock 等を消費
└── functions/<node>/ # Node defineFunction — SQS イベントソース消費など

apps/* / packages/*   ← フロント。AWS SDK 呼び出しを置かない
```

- **フロントが話す相手は AppSync（Amplify Data / AI Kit）か FastAPI の Function URL のみ**。
  SQS/Bedrock/Step Functions には直接アクセスしない。
- **boto3 は `backend-py` の依存に追加**する（`.claude/rules/python-monorepo.md` / `.claude/rules/commands.md` に従い
  devenv 経由・`uv add --package <service> boto3`）。AWS SDK のバージョン管理もここで一元化。
- 共有フロントロジックは `packages/*`、AWS サービスのオーケストレーションは backend-only。

---

## 8. Gotchas

- **最小権限 IAM**: `grant*` を優先し、`addToRolePolicy` でも `resources` を具体的 ARN に絞る。
  `actions: ['*']` / `resources: ['*']` は禁止。
- **`backend.ts` の循環参照**: 追加リソースは**必ず `defineBackend(...)` の後**に書く。
  「構築子を `createStack` 内で先に作り、`grant*` は defineBackend 後にまとめて呼ぶ」。
  関数→リソース→関数のような相互参照は env 注入を後段に寄せて切る。
- **Bedrock のモデルアクセスはリージョン単位**で有効化が必要（sandbox/本番の各リージョンで個別に）。
  モデル ID は使うリージョンで利用可能なものを指定する。
- **SQS イベントソースの消費側は Node `defineFunction`**。Python の Function URL はイベントソースに
  できない（produce は FastAPI でよいが、consume は Node 関数を立てる）。
- **コールドスタート / 長時間処理**: 同期の Function URL（最大 15 分・呼び出し側が待つ）ではなく
  **SQS + 非同期 worker** にオフロードする。重い Bedrock/バッチ処理は特にそう。
- **`addOutput({ custom })` の型は緩い**（任意の string マップ）。キー名のタイポはビルドで弾かれないので
  フロント側の参照キーと厳密に一致させる。
- **コスト**: Bedrock は従量課金、SQS/Step Functions/EventBridge も呼び出し課金。
  ループや高頻度 invoke を作る前に料金を確認する。
