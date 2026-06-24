# Amplify Gen2 — Generative AI（生成AI）

このボイラープレートで生成AIを実装するときの**正本**。許可されるパターンは **2 つだけ**:

1. **Interactive AI = SSE ストリーミング**（既定 / 正統）— トークンを **Server-Sent Events** で
   クライアントに逐次流す。
2. **Long-running AI agent = バックグラウンド処理 + DB ステータス + リアルタイム監視** — エージェント
   をバックグラウンドで走らせ、ジョブ行を **Amplify Data** に永続化し、フロントは **AppSync
   subscription（`observeQuery` / `onUpdate`）** でリアルタイムに進捗を見る。

> **バックエンド既定は TypeScript（Node `defineFunction`）**（`.claude/rules/backend-architecture.md`）。
> Python（`backend-py` FastAPI）は LLM / 長時間 / Python 固有のときだけのエスカレーション経路。
> 本書は **TS パスを第一**に提示し、Python は注記する。

## 目次

1. [決定マトリクス](#1-決定マトリクス)
2. [Pattern A: SSE ストリーミング（interactive）](#2-pattern-a-sse-ストリーミングinteractive)
   - [TS 関数（Hono streamSSE + streamHandle）](#ts-関数hono-streamsse--streamhandle)
   - [backend.ts で Function URL（RESPONSE_STREAM）](#backendts-で-function-urlresponse_stream)
   - [フロント（SSE 消費）](#フロントsse-消費)
   - [マネージド代替: Amplify AI Kit（a.conversation）](#マネージド代替amplify-ai-kitaconversation)
   - [Python（エスカレーション）の注意](#pythonエスカレーションの注意)
3. [Pattern B: 長時間エージェント（background + status + realtime）](#3-pattern-b-長時間エージェントbackground--status--realtime)
   - [Data モデル AgentJob](#data-モデル-agentjob)
   - [worker がステータスを更新](#worker-がステータスを更新)
   - [フロントが 1 ジョブを監視](#フロントが-1-ジョブを監視)
   - [B か C か（worker Lambda か AgentCore か）](#b-か-c-かworker-lambda-か-agentcore-か)
3.5. [Pattern C: Amazon Bedrock AgentCore（超長時間 / サンドボックス）](#35-pattern-c-amazon-bedrock-agentcore超長時間--サンドボックス)
4. [LLM クライアント（LangChain）](#4-llm-クライアントlangchain)
5. [Gotchas](#5-gotchas)

---

## 1. 決定マトリクス

リクエストが**対話的で短い**（チャット返信、補完、要約）なら **Pattern A: SSE ストリーミング**。
**バックグラウンドだが Lambda の15分以内で収まりサンドボックス不要**なら **Pattern B: ワーカー Lambda +
DB ステータス + subscription**。**Lambda の15分を超える、または隔離サンドボックス（AI/任意コードの実行・
ブラウザ操作）が要る**なら **Pattern C: Amazon Bedrock AgentCore**。B と C は監視機構（DB ステータス +
AppSync サブスク）を共有し、違いは**処理本体をどこで走らせるか**だけ。

| 観点 | A（SSE） | B（worker Lambda） | C（AgentCore） |
|---|---|---|---|
| 体感 | 1 トークンずつ即時 | 進捗を live 更新 | 進捗を live 更新 |
| 想定時間 | 〜数十秒（< 15分） | 〜15分（Lambda 上限） | **最大 8 時間**（Runtime） |
| サンドボックス | 不要 | 不要 | **隔離コード実行/ブラウザ**（Code Interpreter / Browser） |
| 処理本体 | Function URL `RESPONSE_STREAM` | worker Lambda | **AgentCore Runtime / tools** |
| 監視 | `fetch` reader | `observeQuery` / `onUpdate` | `observeQuery` / `onUpdate`（B と同じ） |

---

## 2. Pattern A: SSE ストリーミング（interactive）

トークン源は **LangChain `ChatBedrockConverse` の `.stream()`**（既定）。Lambda は
**response streaming** が要るので Function URL を `InvokeMode.RESPONSE_STREAM` にし、Hono の
`streamHandle`（`hono/aws-lambda`）で export する。SSE フレームは `streamSSE`（`hono/streaming`）。

依存追加（bun・`packages/backend`）:

```bash
bun add hono @langchain/aws @langchain/core
# 低レベル代替を使う場合: bun add @aws-sdk/client-bedrock-runtime
```

### TS 関数（Hono streamSSE + streamHandle）

```typescript
// amplify/functions/ai-stream/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const aiStream = defineFunction({
  name: 'ai-stream',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 300, // SSE は < Lambda 15 分。長尺は Pattern B へ
  memoryMB: 1024,
})
```

```typescript
// amplify/functions/ai-stream/app.ts
import { ChatBedrockConverse } from '@langchain/aws'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

export const app = new Hono()

const model = new ChatBedrockConverse({
  model: 'anthropic.claude-3-5-haiku-20241022-v1:0', // 利用リージョンで model access 有効化
  region: process.env.AWS_REGION,
  temperature: 0.7,
})

app.post('/chat', async (c) => {
  const { prompt } = await c.req.json<{ prompt: string }>()

  return streamSSE(c, async (stream) => {
    try {
      // LangChain .stream() は AIMessageChunk を yield する非同期イテレータ
      for await (const chunk of await model.stream(prompt)) {
        const text = typeof chunk.content === 'string' ? chunk.content : ''
        if (text) await stream.writeSSE({ event: 'token', data: text })
      }
      await stream.writeSSE({ event: 'done', data: '[DONE]' })
    } catch (error: unknown) {
      // エラーは握りつぶさない（error-handling.md）。クライアントに伝えてログにも残す
      console.error('ai-stream failed', error)
      await stream.writeSSE({ event: 'error', data: 'stream_failed' })
    }
  })
})
```

```typescript
// amplify/functions/ai-stream/handler.ts
import { streamHandle } from 'hono/aws-lambda' // ← handle ではなく streamHandle
import { app } from './app'

export const handler = streamHandle(app)
```

> `app` を別ファイルにしておくと `app.request('/chat', ...)` で単体テストできる
> （`functions/rest-api` と同じ流儀。SSE 経路自体は手動検証 / E2E）。
> 低レベル代替は `@aws-sdk/client-bedrock-runtime` の `ConverseStreamCommand` を `for await`
> し、`event.contentBlockDelta?.delta?.text` を `writeSSE` する（IAM は同じ・後述）。

### backend.ts で Function URL（RESPONSE_STREAM）

`InvokeMode` は **`aws-cdk-lib/aws-lambda`** から import。Bedrock の権限は
**`bedrock:InvokeModelWithResponseStream`**（aws-services.md の `addToRolePolicy` パターン）。

```typescript
// amplify/backend.ts（抜粋）
import { defineBackend } from '@aws-amplify/backend'
import {
  FunctionUrlAuthType,
  HttpMethod,
  InvokeMode, // ← RESPONSE_STREAM
} from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import { aiStream } from './functions/ai-stream/resource'

const backend = defineBackend({ /* auth, data, storage, */ aiStream })
const fn = backend.aiStream.resources.lambda

// Bedrock ストリーム呼び出しを許可（aws-services.md 参照）
fn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModelWithResponseStream'],
    resources: [
      `arn:aws:bedrock:${backend.stack.region}::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0`,
    ],
  })
)

// 応答ストリーミング有効な Function URL
const url = fn.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE, // 認可はハンドラ側で Cognito JWT 検証
  invokeMode: InvokeMode.RESPONSE_STREAM, // ★ これが無いとバッファされる
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.ALL],
    allowedHeaders: ['*'],
  },
})

backend.addOutput({ custom: { aiStreamUrl: url.url } })
```

> `authType: NONE` は誰でも叩けるので、ハンドラ内で **Cognito JWT 検証**を必ず行う
> （`functions/rest-api` の auth 流儀）。`RESPONSE_STREAM` Function URL は **VPC 内では非対応**
> （configuration-response-streaming）。

### フロント（SSE 消費）

subscription を張る WebSocket は不要。`fetch` + `response.body.getReader()` で読む。
**ストリーミングは Client Component のみ**（SSR からは流さない）。Cognito JWT を Authorization に載せる。

```tsx
'use client'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useState } from 'react'

const AI_STREAM_URL = process.env.NEXT_PUBLIC_AI_STREAM_URL! // amplify_outputs.json の custom 値

export function useAiStream() {
  const [text, setText] = useState('')

  async function send(prompt: string) {
    setText('')
    const { tokens } = await fetchAuthSession()
    const jwt = tokens?.idToken?.toString()

    const res = await fetch(`${AI_STREAM_URL}chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`, // ハンドラで検証
      },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    // SSE フレームは "event: token\ndata: <text>\n\n"。簡易パース例
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (data && data !== '[DONE]') setText((p) => p + data)
        }
      }
    }
  }

  return { text, send }
}
```

> GET で良ければブラウザ標準 `EventSource` も使えるが、`EventSource` は **ヘッダを付けられない**
> ため、JWT を Authorization で渡したいなら上の `fetch` + reader（POST）が確実。
> 配置は FSD の `features/<ai>/model/`（クライアントフック）。

### マネージド代替: Amplify AI Kit（a.conversation）

手動 SSE を書きたくない場合、**Amplify AI Kit** の `a.conversation()` ルートは Lambda が Bedrock の
ストリーミングを受け、**AppSync subscription（WebSocket）越し**にアシスタントのトークンをチャンク配信
する。クライアントは `useAIConversation` フックが subscription を抽象化し、メッセージを React state
として更新してくれる（手動の `onStreamEvent` 購読も可能）。

```typescript
// amplify/data/resource.ts（抜粋）— 会話ルートを定義
const schema = a.schema({
  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Haiku'),
      systemPrompt: 'You are a helpful assistant.',
    })
    .authorization((allow) => allow.owner()), // 会話は所有者のみ
})
```

```tsx
'use client'
import { createAIHooks } from '@aws-amplify/ui-react-ai'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '@workspace/backend'

const { useAIConversation } = createAIHooks(generateClient<Schema>())

export function Chat() {
  // messages はチャンク到着ごとに更新される React state
  const [{ data: { messages } }, sendMessage] = useAIConversation('chat')
  return <button onClick={() => sendMessage({ content: [{ text: 'Hi' }] })}>send</button>
}
```

**いつ AI Kit を選ぶ**: チャット履歴の永続化・所有者認可・ツール実行を Amplify に**丸ごと任せたい**
turnkey なチャット。**既定はあくまで手動 SSE（Pattern A）** で、レスポンス制御・非チャット用途・
独自プロトコルが要るときはそちらを使う。

### Python（エスカレーション）の注意

FastAPI の `StreamingResponse`（SSE）を Lambda で動かすには **response streaming** が要るが、
**Mangum は応答ストリーミングを未サポート**。Python で SSE を流すなら
**AWS Lambda Web Adapter**（custom runtime 相当）が必須（configuration-response-streaming も
Node 以外は Web Adapter / custom runtime を案内）。本リポジトリの `functions/api` は Mangum 構成
なので、**ストリーミングは既定で TS 関数（Pattern A）を使う**こと。

---

## 3. Pattern B: 長時間エージェント（background + status + realtime）

フロー:

```
client → AgentJob.create(mutation)     # PENDING の行を作る
       → worker をトリガー（SQS enqueue / create イベント / カスタム mutation）
worker(Lambda) → エージェント実行（LangChain/Bedrock, 多段）
              → AgentJob.update(status / progress / result)  # server-side data client (IAM)
client ← observeQuery / onUpdate(filter id) で進捗を live 受信（realtime.md）
```

### Data モデル AgentJob

```typescript
// amplify/data/resource.ts（抜粋）
import { a } from '@aws-amplify/backend'

const schema = a.schema({
  AgentJob: a
    .model({
      status: a.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']),
      prompt: a.string().required(),
      result: a.string(),
      error: a.string(),
      progress: a.float(), // 0.0 〜 1.0
    })
    .authorization((allow) => [
      allow.owner(), // 所有者は自分のジョブを read/subscribe
    ]),
})
```

> worker は所有者ではないため、**所有者以外の書き込み経路**が要る（下の認可注記）。

### worker がステータスを更新

worker は **server-side data client（IAM 認可）** で行を更新する。クライアントの owner 認可では
worker は書けないので、`authMode: 'iam'` を使い、モデルに IAM ロールの write 許可を足す。

```typescript
// amplify/functions/agent-worker/handler.ts
import { ChatBedrockConverse } from '@langchain/aws'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '@workspace/backend'
import type { SQSHandler } from 'aws-lambda'

const client = generateClient<Schema>({ authMode: 'iam' }) // server-side / IAM
const model = new ChatBedrockConverse({
  model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  region: process.env.AWS_REGION,
})

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { id, prompt } = JSON.parse(record.body) as { id: string; prompt: string }

    // 1) RUNNING に遷移
    const running = await client.models.AgentJob.update({ id, status: 'RUNNING', progress: 0 })
    if (running.errors) throw new Error(running.errors[0]?.message) // 握りつぶさない

    try {
      // 2) 多段エージェント（ここでは単段 invoke。LangGraph 等で多段化）
      const res = await model.invoke(prompt)
      const result = typeof res.content === 'string' ? res.content : JSON.stringify(res.content)

      // 3) SUCCEEDED + result
      const done = await client.models.AgentJob.update({
        id,
        status: 'SUCCEEDED',
        progress: 1,
        result,
      })
      if (done.errors) throw new Error(done.errors[0]?.message)
    } catch (error: unknown) {
      console.error('agent-worker failed', error)
      await client.models.AgentJob.update({
        id,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
}
```

> トリガーは **SQS enqueue が既定**（aws-services.md の SQS 統合）。軽量なら Data の create イベント
> を購読する関数や、`a.mutation().handler(a.handler.function(...))` のカスタム mutation でも可。
> 重い処理を同期 mutation 内で回さず、必ず非同期 worker に逃がす。Bedrock 権限・SQS 配線・worker への
> IAM data 書き込み付与は **aws-services.md** 参照。

### フロントが 1 ジョブを監視

クライアントはジョブ作成後、その `id` の更新だけを購読する（**Client Component のみ**, realtime.md）。

```tsx
'use client'
import type { Schema } from '@workspace/backend'
import { getDataClient } from '@workspace/data-client'
import { useEffect, useState } from 'react'

type AgentJob = Schema['AgentJob']['type']

// 作成（mutation）。trigger（SQS enqueue 等）はバックエンド側で行う
export async function startAgent(prompt: string) {
  const { data, errors } = await getDataClient().models.AgentJob.create({
    status: 'PENDING',
    prompt,
  })
  if (errors) throw new Error(errors[0]?.message ?? 'create failed')
  return data!
}

// 1 ジョブの更新を live 監視（onUpdate + filter）
export function useAgentJob(id: string) {
  const [job, setJob] = useState<AgentJob | null>(null)
  useEffect(() => {
    const sub = getDataClient()
      .models.AgentJob.onUpdate({ filter: { id: { eq: id } } })
      .subscribe({
        next: (updated) => setJob(updated),
        error: (err) => console.error('agent job subscribe failed', err),
      })
    return () => sub.unsubscribe() // 必須クリーンアップ
  }, [id])
  return job // job.status / job.progress / job.result / job.error を描画
}
```

> 一覧で複数ジョブを live 表示するなら `observeQuery()`（realtime.md §1）。`onUpdate` の filter で
> 使う `id` は、更新 mutation の selectionSet に含まれている必要がある（realtime.md §3）。

### B か C か（worker Lambda か AgentCore か）

background にする理由（SSE と比較）: タイムアウト回避・耐久性/再開・複数ウォッチャ・疎結合
（enqueue → worker → DB → subscription、aws-services.md SQS）。そのうえで処理本体を **B（worker
Lambda）か C（AgentCore）か**は次で決める:

- **worker Lambda（B）**: 処理が **≤15分** で **サンドボックス不要**。SQS/Bedrock 連携で十分なジョブ。
- **AgentCore（C）**: **15分を超える** or **隔離サンドボックスが要る**（AI/任意コードの実行、ブラウザ操作、
  多段の自律エージェント）。→ 下の §3.5。

監視（DB ステータス + AppSync サブスク）は **B でも C でも同じ**。

---

## 3.5 Pattern C: Amazon Bedrock AgentCore（超長時間 / サンドボックス）

**Lambda の15分上限を超える**、または **隔離サンドボックスが必要**（AI/LLM が生成した任意コードの実行、
ブラウザ操作など未検証処理）なエージェントは、worker Lambda ではなく **Amazon Bedrock AgentCore** を使う。
監視は Pattern B と同じ（`AgentJob` + `observeQuery`/`onUpdate`）。

| 機能 | 用途 | 主要仕様 |
|---|---|---|
| **AgentCore Runtime** | エージェント本体を長時間ホスト | **最大8時間**/セッション（既定 28800s・設定可）、**microVM セッション隔離**、同期/非同期、`InvokeAgentRuntime`（+ `InvokeAgentRuntimeWithWebSocketStream`）。Strands / LangGraph 等をそのままホスト |
| **AgentCore Code Interpreter** | AI生成/任意コードの隔離実行 | Python/JS/TS、**既定15分→最大8時間**、内部データ参照、インターネット可、インライン100MB / S3 経由 5GB、CloudTrail |
| **AgentCore Browser** | エージェントのブラウザ操作を隔離実行 | サンドボックス化されたブラウザツール |

### 配線（AgentCore × Amplify Data 監視）

```
client → AgentJob.create(mutation)                 # PENDING
       → orchestrator が AgentCore Runtime を非同期起動（InvokeAgentRuntime, sessionId）
AgentCore Runtime（最大8時間） → エージェント実行（LangGraph/Strands）
   ├─ 必要なら Code Interpreter / Browser を隔離ツールとして呼ぶ
   └─ 進捗/結果を Amplify Data に書き戻す（IAM 認可の data client。worker か AgentCore からのコールバック）
client ← observeQuery / onUpdate(filter id) で live 監視（B と同じ）
```

- **起動**: 軽量な TS の Amplify Function（or Step Functions）を**オーケストレータ**にして
  `@aws-sdk/client-bedrock-agentcore` の `InvokeAgentRuntime`（agent ARN + sessionId）で起動する。
  長時間処理は Lambda で待たず**非同期に投げて即 return**し、状態は AgentCore→Amplify Data で反映する。
- **IAM（最小権限）**: オーケストレータに `bedrock-agentcore:InvokeAgentRuntime`、コード実行を使うなら
  Code Interpreter 系アクションを付与（`addToRolePolicy`、`references/aws-services.md`）。
- **ステータス更新**: AgentCore 側のエージェントコードが `@workspace/data-client` 相当（または AppSync の
  HTTP）で `AgentJob` を **IAM 認可**で更新するか、進捗イベントをオーケストレータ経由で書き戻す。
- **サンドボックスだけ欲しい場合**: 既存の worker からコードの**実行部分だけ** Code Interpreter に逃がす
  （worker 自体は ≤15分でも、未検証コードは素の Lambda で実行しない）。
- **`a.conversation`（AI Kit）との関係**: ターンキーなチャットは AI Kit、**長時間/サンドボックスの自律
  エージェントは AgentCore**、と棲み分ける。
- LangChain/LangGraph/Strands をそのままホストできるので、`@langchain/aws`（§4）の知識はそのまま活きる。

> AgentCore の各機能の完全な API・セッション管理・コスト最適化は**専用スキル（将来追加）**に委ねる。
> ここでは Amplify との継ぎ目（起動・IAM・`AgentJob` ステータス + リアルタイム監視）に集中する。

---

## 4. LLM クライアント（LangChain）

LLM 呼び出しは **LangChain** を使う（`.claude/rules/backend-py.md` LLM ポリシー）。

| 用途 | TS | Python（エスカレーション時） |
|---|---|---|
| パッケージ | `@langchain/aws` `ChatBedrockConverse` | `langchain-aws` `ChatBedrockConverse` |
| ストリーミング（Pattern A） | `model.stream(prompt)` → `for await` | `model.astream(prompt)` |
| 一括（Pattern B / worker） | `model.invoke(prompt)` | `model.invoke(...)` |
| 低レベル代替 | `@aws-sdk/client-bedrock-runtime` `ConverseStreamCommand` | boto3 `bedrock-runtime` |

- **Bedrock のモデルアクセスはリージョン単位で有効化**が必要（sandbox / 本番の各リージョン）。
  未有効だと `AccessDeniedException`（aws-services.md）。
- IAM: ストリームは **`bedrock:InvokeModelWithResponseStream`**、一括は **`bedrock:InvokeModel`**。
  付与は aws-services.md の `addToRolePolicy` パターンで foundation-model ARN を resources に指定。

---

## 5. Gotchas

- **Function URL の `RESPONSE_STREAM` 必須**: `invokeMode` 未指定だと応答は**バッファ**され、
  TTFB が改善しない（トークンが一気に届く）。`InvokeMode.RESPONSE_STREAM` を必ず付ける。
  Lambda コンソールのテストでは**常にバッファ表示**になる点にも注意。
- **`streamHandle` を使う**: SSE 関数の export は `handle` ではなく `streamHandle`
  （`hono/aws-lambda`）。`handle` のままだとストリームされない。
- **Lambda 15 分上限**: SSE は < 15 分。超えるなら Pattern B（background）へ。ストリーミングは
  接続が切れても課金され、関数 duration 全体が請求されるので長い timeout は慎重に。
- **CloudFront / プロキシのバッファ**: 間に CDN/プロキシを挟むと SSE がバッファされ得る。
  該当経路は**バッファ無効化**（チャンク転送・`X-Accel-Buffering: no` 相当）を確認する。
- **SSR からストリームしない**: SSE 消費・subscription は **Client Component のみ**（realtime.md）。
- **subscription 認可**: クライアント購読は **owner**、worker 書き込みは **IAM**。worker は
  `generateClient({ authMode: 'iam' })` を使い、モデルに IAM write を許可する（aws-services.md）。
  `onUpdate` の filter フィールドは更新 mutation の selectionSet に含めること（realtime.md §3）。
- **コスト / スロットリング**: Bedrock は従量課金。多発・並列はスロットルされ得るので、worker は
  リトライ・指数バックオフを入れ、重い処理は SQS で平準化する。
- **Mangum は stream 不可**: Python で SSE が要るなら **Lambda Web Adapter** が必須
  （Mangum 構成の `functions/api` では流せない）。既定は TS の Pattern A。
- **Bedrock model access**: 使うリージョンで Foundation Model アクセスを有効化していないと
  `AccessDeniedException`。sandbox と本番の各リージョンで個別に有効化する。
- **15分超 / サンドボックスは AgentCore**: worker Lambda は ≤15分・サンドボックス不要のときだけ。
  超えるか、未検証/AI生成コードを実行するなら **AgentCore（§3.5）** に逃がす。素の Lambda で任意コードを
  実行しない（隔離されていない）。AgentCore Runtime は最大8時間・microVM 隔離。
- **AgentCore のコスト/セッション**: Runtime/Code Interpreter は実行時間課金。セッションは使い終わったら
  必ずクローズ（Code Interpreter は `code_session` context manager / close）。長時間でも `AgentJob` の
  ステータス + サブスクで監視するのは B と同じ。
