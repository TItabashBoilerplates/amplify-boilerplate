# Amplify Gen2 Storage (Amazon S3)

Amplify Storage は **Supabase Storage の置き換え**。本リポジトリでは backend 定義を
`frontend/packages/backend/amplify/storage/resource.ts` に置き、クライアントは
`aws-amplify/storage` の API を使う。

> **既定は「非公開」**。アクセスは `defineStorage({ access })` の **path 単位ルール**で
> 明示的に許可した範囲だけ。RESTful な path 規約（`{resource}/{id}/...`）を踏襲する。

バージョン: `@aws-amplify/backend` ^1.23 / `aws-amplify` ^6.18 / `aws-cdk-lib` ^2.234。

## 目次

- [defineStorage（backend 定義）](#definestoragebackend-定義)
  - [access ルールと path トークン](#access-ルールと-path-トークン)
  - [アクセスアクションとアクター](#アクセスアクションとアクター)
  - [複数バケット](#複数バケット)
  - [トリガー（onUpload / onDelete）](#トリガーonupload--ondelete)
  - [keepOnDelete](#keepondelete)
- [クライアント API（aws-amplify/storage）](#クライアント-apiaws-amplifystorage)
  - [path コールバック形式](#path-コールバック形式)
  - [uploadData](#uploaddata)
  - [downloadData](#downloaddata)
  - [getUrl](#geturl)
  - [list](#list)
  - [remove](#remove)
  - [copy](#copy)
  - [getProperties](#getproperties)
- [Server-side getUrl](#server-side-geturl)

---

## defineStorage（backend 定義）

本リポジトリの実体（`amplify/storage/resource.ts`）:

```typescript
import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'amplifyBoilerplateStorage',
  access: (allow) => ({
    'media/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
})
```

`backend.ts` で登録:

```typescript
const backend = defineBackend({ auth, data, storage, api })
```

`name` は「backend 設定上でバケットを識別するフレンドリ名」。クライアント側で
`bucket: '<name>'` として参照できる。

### access ルールと path トークン

`access` は `(allow) => ({ 'path/*': [...] })` を返すコールバック。

- path は **必ず `/*` で終わる**。ネストは 1 段まで。サブパスのルールは親パスを**常に上書き**する。
- **path トークン**は実行時にユーザー固有の値へ置換される:

| トークン | 置換される値 |
| --- | --- |
| `{entity_id}` | `allow.entity('identity')` と組で使い、ユーザーの Cognito identity ID に置換。各ユーザーは自分の `media/<その人のID>/*` だけにアクセスできる |
| `{cognito-sub}` | Cognito User Pool の sub（ユーザー固有の UUID）に置換 |

```typescript
access: (allow) => ({
  // 所有者のみ（Cognito identity スコープ） — 本リポジトリの規約
  'media/{entity_id}/*': [
    allow.entity('identity').to(['read', 'write', 'delete']),
  ],
  // 公開アセットが必要な場合のみ明示的に guest read を足す
  'public/*': [
    allow.guest.to(['read']),
    allow.authenticated.to(['read', 'write']),
  ],
  // プロフィール画像: 本人は read/write/delete、他者は read のみ
  'profile-pictures/{entity_id}/*': [
    allow.guest.to(['read']),
    allow.entity('identity').to(['read', 'write', 'delete']),
  ],
})
```

### アクセスアクションとアクター

**アクション**（`.to([...])` に渡す）とクライアント API の対応:

| アクション | 許可されるクライアント API |
| --- | --- |
| `read` | `getUrl`, `downloadData`, `list`, `getProperties`（`get` + `list` の合成） |
| `get` | `getUrl`, `downloadData` |
| `list` | `list`, `getProperties` |
| `write` | `uploadData`, `copy` |
| `delete` | `remove` |

> `read` は `get` と `list` の合成のため、**`get` / `list` と同時には指定できない**。

**アクター**（`allow.*`）:

| アクター | 意味 |
| --- | --- |
| `allow.guest` | 未認証（unauthenticated）ユーザー |
| `allow.authenticated` | サインイン済みの全ユーザー |
| `allow.entity('identity')` | path の `{entity_id}` でスコープした「本人のみ」 |
| `allow.groups(['admin'])` | Cognito グループ。`defineAuth` でグループ定義が必要。authenticated を上書き |
| `allow.resource(fn)` | backend の関数（`defineFunction`）にアクセス権を付与 |

```typescript
'media/*': [
  allow.groups(['auditor']).to(['read']),
  allow.groups(['admin']).to(['read', 'write', 'delete']),
],
```

**関数へのアクセス付与**（CRUD を Lambda に許可）:

```typescript
import { defineFunction } from '@aws-amplify/backend'
const reportFn = defineFunction({ name: 'reports' })

export const storage = defineStorage({
  name: 'myProjectFiles',
  access: (allow) => ({
    'reports/*': [allow.resource(reportFn).to(['read', 'write', 'delete'])],
  }),
})
```

付与された関数には環境変数 `<STORAGE_NAME>_BUCKET_NAME`（例 `MY_PROJECT_FILES_BUCKET_NAME`）が
注入され、ハンドラ内で AWS SDK の `Bucket` に使える。

### 複数バケット

`isDefault: true` を 1 つだけ付ける。クライアントは `options.bucket` で対象を選ぶ。

```typescript
export const firstBucket = defineStorage({
  name: 'firstBucket',
  isDefault: true,
})

export const secondBucket = defineStorage({
  name: 'secondBucket',
  access: (allow) => ({
    'private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
})
```

```typescript
// backend.ts
defineBackend({ auth, firstBucket, secondBucket })
```

### トリガー（onUpload / onDelete）

S3 イベントに反応する Lambda を `triggers` で紐づける。ハンドラは `defineFunction`（Node）で定義。

```typescript
import { defineStorage, defineFunction } from '@aws-amplify/backend'

const onUpload = defineFunction({ name: 'on-upload-handler' })
const onDelete = defineFunction({ name: 'on-delete-handler' })

export const storage = defineStorage({
  name: 'amplifyBoilerplateStorage',
  triggers: {
    onUpload,
    onDelete,
  },
})
```

ハンドラ（`amplify/storage/on-upload-handler/handler.ts`）は `S3Handler` を使う:

```typescript
import type { S3Handler } from 'aws-lambda'

export const handler: S3Handler = async (event) => {
  const objectKeys = event.Records.map((r) => r.s3.object.key)
  console.log(`Upload handler invoked for objects [${objectKeys.join(', ')}]`)
}
```

### keepOnDelete

backend 削除時にバケットを残すか（既定は削除）:

```typescript
export const storage = defineStorage({
  name: 'myProjectFiles',
  keepOnDelete: true,
})
```

---

## クライアント API（aws-amplify/storage）

### path コールバック形式

`{entity_id}` でスコープしたパスへアクセスするには、文字列ではなく
`({ identityId }) => string` のコールバックを渡す。`identityId` はサインイン中ユーザーの
Cognito identity ID で、backend の `{entity_id}` と一致する。

```typescript
path: ({ identityId }) => `media/${identityId}/avatar.jpg`
```

### uploadData

```typescript
import { uploadData } from 'aws-amplify/storage'

const result = await uploadData({
  path: ({ identityId }) => `media/${identityId}/1.jpg`,
  data: file, // Blob | File | ArrayBuffer | string
  options: {
    contentType: 'image/jpeg',
    metadata: { customKey: 'customValue' },
    onProgress: ({ transferredBytes, totalBytes }) => {
      if (totalBytes) {
        console.log(`Upload ${Math.round((transferredBytes / totalBytes) * 100)}%`)
      }
    },
    // bucket: 'assignedNameInAmplifyBackend', // 複数バケット時
  },
}).result
```

- 5MB を超えるオブジェクトは Amplify が自動でマルチパートアップロードする。
- pause / resume / cancel:

```typescript
const task = uploadData({ path, data: file })
task.pause()
task.resume()
task.cancel()
```

### downloadData

ファイル内容をメモリへダウンロード。

```typescript
import { downloadData, isCancelError } from 'aws-amplify/storage'

const { body, eTag } = await downloadData({
  path: ({ identityId }) => `media/${identityId}/1.jpg`,
  options: {
    onProgress: ({ transferredBytes, totalBytes }) => { /* ... */ },
    // bytesRange: { start: 0, end: 1023 }, // 部分ダウンロード
  },
}).result

const text = await body.text() // または body.blob() / body.json()
```

キャンセル:

```typescript
const task = downloadData({ path: 'media/1.jpg' })
task.cancel()
try {
  await task.result
} catch (error) {
  if (isCancelError(error)) {
    console.error('download cancelled', error)
  }
}
```

### getUrl

S3 オブジェクトへの署名付き URL を生成（既定 900 秒＝15 分、最大 1 時間）。

```typescript
import { getUrl } from 'aws-amplify/storage'

const link = await getUrl({
  path: ({ identityId }) => `media/${identityId}/1.jpg`,
  options: {
    validateObjectExistence: true, // 既定 false。存在しないと URL が後で失敗するため必要なら true
    expiresIn: 900,
  },
})
console.log(link.url) // URL
console.log(link.expiresAt) // Date
```

### list

末尾の `/` に注意（`'media/photos'` は `media/photos123.jpg` もマッチしうる）。

```typescript
import { list } from 'aws-amplify/storage'

const result = await list({
  path: ({ identityId }) => `media/${identityId}/`,
  options: {
    listAll: true, // 全件取得（pageSize/nextToken より優先）
    // pageSize: 100,
    // nextToken: '...',
    // subpathStrategy: { strategy: 'exclude' }, // サブフォルダを畳む
  },
})
// result.items: { path, size, lastModified, eTag }[]
// result.nextToken, result.excludedSubpaths
```

### remove

```typescript
import { remove } from 'aws-amplify/storage'

await remove({
  path: ({ identityId }) => `media/${identityId}/1.jpg`,
  // options: { bucket: 'assignedNameInAmplifyBackend' },
})
```

### copy

特殊文字を含む **source は URI エンコードが必要**（destination は不要）。単一操作 5GB まで。

```typescript
import { copy } from 'aws-amplify/storage'

await copy({
  source: {
    path: ({ identityId }) => `media/${identityId}/${encodeURIComponent('#1.jpg')}`,
  },
  destination: {
    path: ({ identityId }) => `shared/${identityId}/#1.jpg`,
  },
})
```

クロスバケットは source / destination 双方で `bucket` を明示する。

### getProperties

```typescript
import { getProperties } from 'aws-amplify/storage'

const props = await getProperties({ path: 'media/1.jpg' })
// props.path / contentType / contentLength / eTag / lastModified / metadata
```

---

## Server-side getUrl

Server Component / Server Action / Route Handler から署名 URL を作るときは、本リポジトリの
Amplify server runner（`runWithAmplifyServerContext`）の中で `aws-amplify/storage/server` の
`getUrl` を使う（クライアントの `aws-amplify/storage` ではなく `/server` を import する）。

```typescript
import { cookies } from 'next/headers'
import { getUrl } from 'aws-amplify/storage/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'

const { url } = await runWithAmplifyServerContext({
  nextServerContext: { cookies },
  operation: (contextSpec) =>
    getUrl(contextSpec, {
      path: ({ identityId }) => `media/${identityId}/1.jpg`,
      options: { validateObjectExistence: true },
    }),
})
```

> エラーは握りつぶさない（`.claude/rules/error-handling.md`）。`getUrl` などは throw 設計のため、
> 呼び出し側の Boundary（`error.tsx` / Server Action 最外層 / FastAPI exception handler）で
> catch + ログする。
