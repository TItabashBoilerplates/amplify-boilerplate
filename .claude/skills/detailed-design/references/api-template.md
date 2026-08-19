# {Feature Name} - API 設計

<!--
  出力先: docs/designs/{feature-name}/api.md
  「その操作をどの層で実行するか」を判定し、API を定義する。

  必須参照:
  - .claude/rules/backend-architecture.md - Amplify Data first / TS Function 既定 / Python は escalation
  - .claude/rules/list-pagination.md      - 一覧は nextToken ページング前提
  - .claude/rules/error-handling.md       - Amplify Data は throw せず { data, errors } を返す
  - .claude/rules/generative-ai.md        - 生成 AI は SSE / worker Lambda / AgentCore の 3 択
  - .claude/rules/datetime.md             - 日時設計ルール
-->

[< data-model.md](./data-model.md) | [ui-ux.md >](./ui-ux.md)

## 実行層の判定（Amplify Data first）

<!--
  すべてのデータ操作は以下の優先順位で実行層を決める:

  1. **Amplify Data**（DEFAULT） -- CRUD + authorization + サブスクリプションで足りる場合
  2. **TypeScript の Amplify Function**（`defineFunction`） -- サーバー側の処理が要る場合
  3. **backend-py**（LAST RESORT） -- LLM / エージェント / 長時間 / Python 固有ライブラリ / 既存資産

  各操作について、なぜその層を選んだかを明記する。
  2 を選ぶなら「なぜ Amplify Data だけでは足りないか」、
  3 を選ぶなら **escalation トリガーのどれに該当するか**を必須で書く。

  ⚠️ **CRUD だけの API エンドポイントを作らない**。
  それは Amplify Data + authorization が既にやっている仕事である
  （.claude/rules/minimal-implementation.md）。
-->

### 判定結果

| 操作 | 実行層 | 理由 |
|---|---|---|
| {操作1: データ取得} | Amplify Data | `allow.owner()` でレコード単位の認可が効く |
| {操作2: データ作成} | Amplify Data | `create` + authorization で十分 |
| {操作3: Webhook 受信} | TS Amplify Function | 外部からの HTTP を受ける必要があり、署名検証もサーバー側でしか行えない |
| {操作4: LLM 処理} | backend-py | escalation: LangGraph の多段エージェント（`backend-architecture.md` §2） |

## Amplify Data API（Frontend から直接）

<!--
  authorization で保護された操作。Frontend / Server Component の双方から
  `getDataClient()`（@workspace/data-client）で呼ぶ。

  ⚠️ Amplify Data のクライアントは **throw せず `{ data, errors }` を返す**。
  errors のチェックを省くと「エラーなのか空なのか区別できない」状態になる
  （.claude/rules/error-handling.md）。
-->

### データ取得

```typescript
// entities/{entity}/api/queries.ts
// TanStack Query + Amplify Data
// 詳細: .claude/skills/tanstack-query/, .claude/skills/amplify-gen2/

import { getDataClient } from '@workspace/data-client'

export const {entity}Keys = {
  all: ['{entities}'] as const,
  lists: () => [...{entity}Keys.all, 'list'] as const,
  list: (filters: string) => [...{entity}Keys.lists(), filters] as const,
  details: () => [...{entity}Keys.all, 'detail'] as const,
  detail: (id: string) => [...{entity}Keys.details(), id] as const,
}

export const PAGE_SIZE = 20

// 一覧: **必ず limit を明示し、終端判定は nextToken**
//   ⚠️ data.length < limit を「末尾」と解釈してはならない。DynamoDB は limit 件を
//   読んでからフィルタするため、フィルタ付きクエリは 0 件を返しつつ nextToken を返す
//   （.claude/rules/list-pagination.md §6.1）。
export function use{Entities}Infinite() {
  return useInfiniteQuery({
    queryKey: {entity}Keys.list('infinite'),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, nextToken, errors } = await getDataClient()
        .models.{Model}.list{Model}ByOwner(
          { ownerId },
          { sortDirection: 'DESC', limit: PAGE_SIZE, nextToken: pageParam ?? undefined },
        )
      if (errors) {
        console.error('Failed to load {entities}:', errors)
        throw new Error(errors[0]?.message ?? 'Query failed')
      }
      return { items: data, nextToken: nextToken ?? null }
    },
    getNextPageParam: (lastPage) => lastPage.nextToken ?? undefined,
  })
}

// 単体取得
// getDataClient().models.{Model}.get({ id })
```

### データ更新

```typescript
// features/{feature}/api/{action}.ts
// getDataClient().models.{Model}.create({ ... })
// getDataClient().models.{Model}.update({ id, ... })
// getDataClient().models.{Model}.delete({ id })
//
// 成功後の invalidate は**そのリストのキーにピンポイント**で
// （.claude/rules/render-optimization.md）
```

### Server Component から呼ぶ場合

```typescript
// 認可判断は必ずサーバー側で。Client の useAuthUser() の値を根拠にしない
// （.claude/rules/auth.md §3.7）
import { cookies } from 'next/headers'
import { getCurrentUser } from 'aws-amplify/auth/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'

const user = await runWithAmplifyServerContext({
  nextServerContext: { cookies },
  operation: (contextSpec) => getCurrentUser(contextSpec),
}).catch(() => null)
```

## Storage（Amazon S3）

<!--
  Amplify Storage を使う場合に記載する。不要なら:
  N/A -- この機能ではファイルを扱わない

  必須参照: .claude/rules/storage-images.md
-->

### パス設計

| パス | 公開性 | 用途 |
|---|---|---|
| `media/{entityId}/avatar.jpg` | 非公開（本人のみ） | {用途} |
| `public/hero/cover.jpg` | 公開 | {用途} |

```typescript
// frontend/packages/backend/amplify/storage/resource.ts
export const storage = defineStorage({
  name: '{bucketName}',
  access: (allow) => ({
    'media/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    'public/*': [allow.guest().to(['read']), allow.authenticated().to(['read'])],
  }),
})
```

### 画像の配信（**原本を配らない**）

<!--
  ⚠️ 表示する画像を元サイズのまま配ってはならない（.claude/rules/storage-images.md）。
  無変換でも画面は正しく表示され、lint も型も通るので、レビューでは見つからない。
  気づけるのは請求が上がったときだけ。
-->

| 対象 | 使うもの |
|---|---|
| Web | `@/shared/ui` の `StorageImage`（`next/image` 経由） |
| Mobile | `@/shared/ui` の `StorageImage`（`resolveUrl(pixelWidth)`） |
| URL だけ欲しい | `@workspace/storage-image` の `createSignedImageUrl` / `buildDerivativePath` |

**DB には `path` を保存する**（完全な URL を保存すると、バケット移行・ドメイン変更・
公開/非公開の切り替えで全レコードが一斉に壊れる）。

## リアルタイム（AppSync サブスクリプション）

<!--
  Amplify Data のサブスクリプションを使う場合に記載する。不要なら:
  N/A -- この機能ではリアルタイム更新を行わない

  ⚠️ observeQuery は**モデル全体の同期**を前提にしており、
  件数が増えうる一覧のページングとは併用しない（.claude/rules/list-pagination.md §5）。
  一覧は list + nextToken、更新の反映は onCreate / onUpdate / onDelete を購読する。
-->

| 購読 | モデル | イベント | 用途 |
|---|---|---|---|
| {name} | {Model} | onCreate / onUpdate / onDelete | {用途} |

```typescript
'use client'
// Client Component でのみ購読する（Server Component では動かない）
useEffect(() => {
  const sub = getDataClient().models.{Model}.onUpdate().subscribe({
    next: (item) => {
      // 該当するクエリキーだけを更新 / invalidate する
    },
    error: (error) => console.error('subscription failed:', error),
  })
  return () => sub.unsubscribe()
}, [])
```

## TypeScript の Amplify Function

<!--
  Amplify Data だけでは足りない処理。**バックエンドの既定はここ**
  （.claude/rules/backend-architecture.md §1）。

  不要な場合: N/A -- この機能では Function を追加しない

  置き場所: frontend/packages/backend/amplify/functions/{name}/
  - REST は Hono（hono/aws-lambda）
  - 共有ロジックは @workspace/backend-core
  - AppSync のカスタムロジックなら a.query / a.mutation + a.handler.function
-->

### なぜ Amplify Data だけでは足りないか

{具体的な理由を記述。例: 外部 Webhook の署名検証はクライアントに置けない / 秘匿値を使う処理}

### 定義

```typescript
// frontend/packages/backend/amplify/functions/{name}/resource.ts
import { defineFunction, secret } from '@aws-amplify/backend'

export const {name} = defineFunction({
  name: '{name}',
  entry: './handler.ts',
  timeoutSeconds: 30,
  // 秘匿値は env ではなく Amplify secrets（SSM）。.claude/rules/env-naming.md
  environment: { EXTERNAL_API_KEY: secret('EXTERNAL_API_KEY') },
})
```

```typescript
// frontend/packages/backend/amplify/functions/{name}/handler.ts
import { env } from '$amplify/env/{name}'

export const handler = async (event: {EventType}) => {
  // 握りつぶさない。catch したら必ずログを出して再送出する
  // （.claude/rules/error-handling.md）
}
```

### 生成 AI を含む場合の実装パターン

<!--
  .claude/rules/generative-ai.md の 3 択から選び、理由を書く:
  A. 対話的・短時間        -> SSE ストリーミング（Hono streamSSE + RESPONSE_STREAM）
  B. 背景処理・15 分以内   -> worker Lambda + ジョブモデルのステータス + AppSync サブスク監視
  C. 15 分超 / サンドボックス -> Amazon Bedrock AgentCore + 同上の監視
-->

| 選んだパターン | 理由 |
|---|---|
| A / B / C | {なぜそれか。とくに「15 分を超えうるか」「未検証コードを実行するか」} |

## Backend Python API

<!--
  **TypeScript の Amplify Function でも足りない場合のみ**使用する（escalation）。
  必ず「どの escalation トリガーに該当するか」を明記する。
  参照: .claude/rules/backend-architecture.md §2 / .claude/rules/backend-py.md

  不要な場合: N/A -- この機能では Backend Python は使用しない
  （Amplify Data first 判定で完結し、escalation トリガーにも該当しない）

  > 環境が用意されていること自体は「Python を使え」という意味ではない。
  > トリガーが無いなら backend-py/ は一切触らないのが正しい。

  構造:
  - controller/ -> HTTP エンドポイント
  - usecase/ -> ビジネスロジック
  - gateway/ -> データアクセス
-->

### escalation トリガー（該当するものに ✓）

<!--
  .claude/rules/backend-architecture.md §2 の 4 つ。**いずれにも該当しないなら
  TypeScript の Amplify Function で書く**（理由なく Python を選んだ実装はやり直し）。
-->

| トリガー | 該当 | 具体的な内容 |
|---|---|---|
| LLM / エージェント（LangChain / LangGraph / RAG） | ☐ | {内容} |
| 長時間・重い処理（Function URL の同期上限を超える / バッチ / 重い数値計算） | ☐ | {内容} |
| Python 固有ライブラリ（pandas / numpy / ML 系 / Python だけにある SDK） | ☐ | {内容} |
| 既存の Python 資産の再利用 | ☐ | {内容} |

{具体的な理由を記述}

### AI/ML 処理時の LangChain 必須ポリシー

> **詳細は `.claude/rules/backend-py.md` の LLM Client Policy セクションを参照。**
> すべての LLM クライアント実装は LangChain を使用すること（直接 SDK 使用は原則禁止）。

### エンドポイント一覧

| メソッド | パス | 用途 | リクエスト | レスポンス |
|---------|------|------|-----------|-----------|
| POST | `/api/{feature}/{action}` | {用途} | `{RequestType}` | `{ResponseType}` |

### リクエスト/レスポンス型

```python
# backend-py/apps/api/src/api/controller/{feature}/schema.py
from pydantic import BaseModel

class {Action}Request(BaseModel):
    field1: str
    field2: int

class {Action}Response(BaseModel):
    id: str
    status: str
```

### Controller

```python
# backend-py/apps/api/src/api/controller/{feature}/router.py
from fastapi import APIRouter, Depends
from sqlmodel import Session

router = APIRouter(prefix="/api/{feature}", tags=["{feature}"])

@router.post("/{action}")
async def {action}(
    request: {Action}Request,
    session: Session = Depends(get_session),
) -> {Action}Response:
    usecase = {Feature}UseCase()
    result = usecase.execute(session, request)
    return {Action}Response(**result)
```

## Hey API クライアント生成

<!--
  Backend Python API を Frontend から呼び出す場合、
  Hey API (@hey-api/openapi-ts) でクライアントを自動生成する。

  生成先: frontend/packages/api-client/src/generated/
  自動生成ファイルは編集禁止（.claude/rules/auto-generated.md）

  生成コマンド: cd frontend && pnpm run --filter @workspace/api-client generate（backend-py の起動が前提）

  Backend Python を使用しない場合:
  N/A -- Backend Python を使用しないため Hey API クライアント生成は不要
-->

### 生成される型とSDK

```typescript
// frontend/packages/api-client/src/generated/types.gen.ts (自動生成)
export type {Action}Request = {
  field1: string
  field2: number
}

// frontend/packages/api-client/src/generated/sdk.gen.ts (自動生成)
export function post{Feature}{Action}(body: {Action}Request): Promise<{Action}Response>
```

### Frontend からの使用

```typescript
// features/{feature}/api/{action}.ts
import { post{Feature}{Action} } from '@workspace/api-client'
import { useMutation } from '@workspace/query'

export function use{Action}() {
  return useMutation({
    mutationFn: (input: {Action}Request) => post{Feature}{Action}({ body: input }),
  })
}
```

## エラーハンドリング

### エラーコード体系

| コード | 意味 | 対応 |
|--------|------|------|
| 400 | バリデーションエラー | フォームエラー表示 |
| 401 | 認証エラー | ログインページへリダイレクト |
| 403 | 権限不足 | エラーメッセージ表示 |
| 404 | リソース未発見 | 404ページ表示 |
| 409 | 競合（重複等） | ユーザーに確認を促す |
| 500 | サーバーエラー | 汎用エラーメッセージ |

### Amplify Data のエラー（**throw しない**）

<!--
  Amplify Data のクライアントは例外を投げず `{ data, errors }` を返す。
  したがって try/catch では捕まらない。errors を見ない実装は
  「エラーなのか空なのか区別できない」状態になる（.claude/rules/error-handling.md）。
-->

```typescript
const { data, errors } = await getDataClient().models.{Model}.list({ limit: PAGE_SIZE })
if (errors) {
  console.error('{Model}.list failed:', errors)
  throw new Error(errors[0]?.message ?? 'Query failed')
}
```

### Amplify Auth のエラー（**throw する**）

<!--
  こちらは契約が逆で、`aws-amplify/auth` の関数は例外を投げる。
  features/auth/api/* は try/catch で受けて
  `{ success: true } | { error: string }` を返す（.claude/rules/auth.md §3）。
  Cognito の例外名 -> 表示メッセージのマッピングは @workspace/auth/validation が正本。
-->

| Cognito の例外 | 意味 | UI の扱い |
|---|---|---|
| `NotAuthorizedException` | 資格情報が違う | 汎用の失敗メッセージ（どちらが違うかは出さない） |
| `UserNotFoundException` | 未登録 | **そのまま出さない**（ユーザー列挙になる） |
| `UsernameExistsException` | 既に登録済み | サインアップ画面で案内 |
| `LimitExceededException` | レート制限 | 時間をおいて再試行を案内 |
