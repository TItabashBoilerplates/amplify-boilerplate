# {Feature Name} - API 設計

<!--
  出力先: docs/designs/{feature-name}/api.md
  Supabase-first ポリシーに基づく API 設計を定義する。

  必須参照:
  - .claude/rules/supabase-first.md - Supabase-first 判定階層
  - .claude/rules/backend-py.md - Backend Python 規約
  - .claude/rules/edge-functions.md - Edge Functions 規約
  - .claude/rules/datetime.md - 日時設計ルール
-->

[< data-model.md](./data-model.md) | [ui-ux.md >](./ui-ux.md)

## Supabase-First 判定

<!--
  すべてのデータ操作は以下の優先順位で実行層を決定する:

  1. supabase-js (DEFAULT) - CRUD + RLS で十分な場合
  2. Edge Functions - Webhook、service_role が必要な場合
  3. Backend Python (LAST RESORT) - 複雑なロジック、AI/ML が必要な場合

  各操作について、なぜその層を選択したかを明記する。
  Backend Python を選択する場合は、supabase-js で不十分な理由を必須で記述。

  参照: .claude/rules/supabase-first.md
-->

### 判定結果

| 操作 | 実行層 | 理由 |
|------|--------|------|
| {操作1: データ取得} | supabase-js | RLS で行レベルアクセス制御が可能 |
| {操作2: データ作成} | supabase-js | INSERT + RLS withCheck で十分 |
| {操作3: Webhook処理} | Edge Functions | service_role キーが必要 |
| {操作4: AI処理} | Backend Python | LangChain によるLLM処理が必要 |

## supabase-js API（Frontend 直接）

<!--
  RLS で保護された操作。Frontend から直接 supabase-js を使用する。

  コード例の詳細パターンは .claude/skills/supabase/SKILL.md を参照。
  ここではこの機能固有のクエリ・ミューテーションのみ記載する。
-->

### データ取得

```typescript
// entities/{entity}/api/queries.ts
// TanStack Query + supabase-js パターン
// 詳細: .claude/skills/tanstack-query/SKILL.md, .claude/skills/supabase/SKILL.md

export const {entity}Keys = {
  all: ['{entities}'] as const,
  lists: () => [...{entity}Keys.all, 'list'] as const,
  list: (filters: string) => [...{entity}Keys.lists(), filters] as const,
  details: () => [...{entity}Keys.all, 'detail'] as const,
  detail: (id: string) => [...{entity}Keys.details(), id] as const,
}

// queryKey: {entity}Keys.list(filters)
// queryFn: supabase.from('{table_name}').select('*').order('created_at', { ascending: false })

// queryKey: {entity}Keys.detail(id)
// queryFn: supabase.from('{table_name}').select('*').eq('id', id).single()
```

### データ変更

```typescript
// features/{feature}/api/{action}.ts
// mutationFn: supabase.from('{table_name}').insert(input).select().single()
// onSuccess: queryClient.invalidateQueries({ queryKey: {entity}Keys.all })
```

### Server Action

```typescript
// features/{feature}/api/{action}.ts
// 'use server'
// supabase = await createClient() (server)
// supabase.auth.getUser() で認証確認
// supabase.from('{table_name}').insert({...})
// revalidatePath('/{path}')
```

## Storage 設計

<!--
  Supabase Storage を使用する場合に記載する。
  使用しない場合: N/A -- この機能では Storage は使用しない

  必須参照: .claude/rules/supabase-first.md の Storage Policy

  ルール:
  - デフォルトは Private バケット（public = false）
  - ファイルアクセスは createSignedUrl を使用
  - パスは RESTful 階層構造: {resource}/{id}/{sub-resource}/{filename}
  - Public バケットはユーザーが明示的に要求した場合のみ
-->

### バケット設計

| バケット名 | 公開設定 | サイズ上限 | 用途 |
|-----------|---------|-----------|------|
| {bucket} | private | {size}MiB | {用途} |

### パス設計

```
{resource}/{id}/{sub-resource}/{filename}

例:
users/{user_id}/avatar.png
projects/{project_id}/attachments/{file_id}.pdf
```

### アップロード

```typescript
// features/{feature}/api/upload.ts
const path = `{resource}/${id}/{filename}`
const { error } = await supabase.storage
  .from('{bucket}')
  .upload(path, file)
```

### ダウンロード（Signed URL）

```typescript
// Private バケットのファイルアクセス（createSignedUrl 必須）
const { data } = await supabase.storage
  .from('{bucket}')
  .createSignedUrl(path, 60)  // 60秒有効

// getPublicUrl は Private バケットでは使用不可
```

### Storage RLS

```sql
-- supabase/config.toml で設定
-- [storage.buckets.{bucket}]
-- public = false
-- file_size_limit = "{size}MiB"
```

## Realtime 設計

<!--
  Supabase Realtime を使用する場合に記載する。
  使用しない場合: N/A -- この機能では Realtime は使用しない

  パターン:
  1. postgres_changes: テーブル変更のリアルタイム購読
  2. Broadcast: クライアント間のメッセージ送受信
  3. Presence: オンライン状態の追跡
-->

### Realtime チャネル設計

| チャネル | パターン | テーブル/トピック | イベント | 用途 |
|---------|---------|----------------|---------|------|
| {channel} | postgres_changes | {table} | INSERT / UPDATE / DELETE | {用途} |
| {channel} | broadcast | {topic} | {event} | {用途} |
| {channel} | presence | {topic} | sync / join / leave | {用途} |

### Realtime Publication 設定（必須）

<!--
  postgres_changes を使用するテーブルは、Realtime Publication に追加する必要がある。
  配置先: drizzle/config/post-migration/ 内の SQL ファイル

  既存パターン参照: drizzle/config/post-migration/00_functions.sql

  注意: この設定がないと postgres_changes イベントが発火しない。
-->

```sql
-- drizzle/config/post-migration/{NN}_{name}.sql
-- Realtime を有効にするテーブルを Publication に追加
ALTER PUBLICATION supabase_realtime ADD TABLE {table_name};
```

<!--
  SQL ファイルの追記 vs 新規作成の判断基準:
  - 独立した機能の Realtime 設定 → 新規ファイル（例: 01_realtime.sql）
  - 既存トリガーに関連する変更 → 既存ファイルに追記
-->

### postgres_changes 購読

```typescript
// entities/{entity}/api/realtime.ts
const channel = supabase
  .channel('{channel-name}')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: '{table_name}',
      filter: 'user_id=eq.{userId}',
    },
    (payload) => {
      queryClient.invalidateQueries({ queryKey: {entity}Keys.all })
    }
  )
  .subscribe()
```

### Broadcast / Presence

```typescript
// Broadcast: クライアント間メッセージ
const channel = supabase.channel('{room}')
channel.send({ type: 'broadcast', event: '{event}', payload: { ... } })

// Presence: オンライン状態
const channel = supabase.channel('{room}')
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({ user_id: userId, online_at: new Date().toISOString() })
  }
})
```

## Edge Functions API

<!--
  service_role が必要な操作、Webhook 処理。
  参照: .claude/rules/edge-functions.md

  不要な場合: N/A -- この機能では Edge Functions は使用しない

  注意:
  - npm: prefix で npm パッケージをインポート
  - postgres.js は deno.land/x から（npm:postgres は禁止）
  - prepare: false を必ず指定
-->

### エンドポイント一覧

| 関数名 | メソッド | 用途 | 認証 |
|--------|---------|------|------|
| {function-name} | POST | {用途} | service_role / JWT |

### 実装例

```typescript
// supabase/functions/{function-name}/index.ts
// バージョンは Context7/WebSearch で最新を確認すること（research-first ポリシー）
import { createClient } from "npm:@supabase/supabase-js"

Deno.serve(async (req: Request) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json()

    // ... ビジネスロジック

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

## Backend Python API

<!--
  supabase-js で不十分な場合のみ使用。
  必ず「なぜ supabase-js では不十分か」を明記する。
  参照: .claude/rules/backend-py.md

  不要な場合: N/A -- この機能では Backend Python は使用しない（Supabase-first 判定により supabase-js で完結）

  構造:
  - controller/ -> HTTP エンドポイント
  - usecase/ -> ビジネスロジック
  - gateway/ -> データアクセス
-->

### supabase-js で不十分な理由

<!--
  以下のいずれかに該当する場合のみ Backend Python を使用:
  - 複雑なトランザクション（マルチテーブルのアトミック操作）
  - AI/ML 処理（LangChain, エンベディング）
  - 外部API連携（複雑なリトライ/エラーハンドリング）
  - 長時間実行のバックグラウンドジョブ
  - Python 固有のライブラリが必要
-->

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

  生成コマンド: devenv tasks run model:build-frontend

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

### Supabase エラーの変換

```typescript
// shared/lib/error.ts
export function handleSupabaseError(error: PostgrestError): AppError {
  switch (error.code) {
    case '23505': return { code: 409, message: 'Already exists' }
    case '42501': return { code: 403, message: 'Permission denied' }
    default: return { code: 500, message: error.message }
  }
}
```
