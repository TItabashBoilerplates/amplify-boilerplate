---
name: hey-api
description: Hey API による Backend API クライアント生成ガイダンス。SDK 関数、TanStack Query hooks、Zod スキーマの自動生成についての質問に使用。型安全な API 通信、認証付きクライアントの実装支援を提供。
---

# Hey API - Backend API Client

`@workspace/api-client` パッケージは Hey API (`@hey-api/openapi-ts`) を使用して `backend-py` (FastAPI) から型安全なクライアントを自動生成します。

## パッケージ構成

```
frontend/packages/api-client/
├── openapi-ts.config.ts      # Hey API 設定
├── src/
│   ├── config.ts             # ランタイム設定（baseUrl）
│   ├── client.ts             # 認証付きクライアントラッパー
│   └── generated/            # 自動生成（編集禁止）
│       ├── sdk.gen.ts        # SDK 関数
│       ├── types.gen.ts      # 型定義
│       ├── zod.gen.ts        # Zod スキーマ
│       └── @tanstack/react-query.gen.ts
└── index.ts                  # パブリック API
```

## 生成コマンド

devenv 経由で生成。直接 `bun run` は禁止。

```bash
# 手動生成 (devenv tasks)
devenv tasks run model:frontend       # Hey API client + Supabase types を一括生成

# dev/build 時に自動実行 (turbo の dependsOn 経由で generate:api が走る)
dev-web                                # 軽量セット + Next.js (web)
build-frontend                         # Next.js production build
```

## 使用方法

### SDK 関数の直接使用

```typescript
import { healthcheckHealthcheckGet, rootGet } from '@workspace/api-client'

// 認証不要
const { data, error } = await healthcheckHealthcheckGet()
```

### 認証付きクライアント

```typescript
import { createBackendClient, rootGet } from '@workspace/api-client'

// Server Component での使用
const client = createBackendClient({
  accessToken: session.access_token,
})

const { data, error } = await rootGet({ client })
```

### TanStack Query hooks

```typescript
import { rootGetOptions } from '@workspace/api-client'
import { useQuery } from '@tanstack/react-query'

// Client Component での使用
const { data, isLoading } = useQuery(rootGetOptions())

// 認証付き
const client = createBackendClient({ accessToken })
const { data } = useQuery(rootGetOptions({ client }))
```

### Zod バリデーション

```typescript
import { zHealthcheckHealthcheckGetResponse } from '@workspace/api-client'

const result = zHealthcheckHealthcheckGetResponse.safeParse(data)
if (result.success) {
  console.log(result.data.message)
}
```

## SDK 関数の命名規則

OpenAPI の operationId から自動生成：

| operationId | SDK 関数 |
|-------------|---------|
| `root_get` | `rootGet` |
| `healthcheck_healthcheck_get` | `healthcheckHealthcheckGet` |
| `list_jobs_api_projects__project_id__jobs_get` | `listJobsApiProjectsProjectIdJobsGet` |

## 設定

### openapi-ts.config.ts

```typescript
import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: `${backendUrl}/openapi.json`,
  output: { path: './src/generated', format: 'biome' },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    { name: '@hey-api/client-fetch', runtimeConfigPath: '../config' },
    { name: '@tanstack/react-query', queryOptions: true, mutationOptions: true },
    { name: 'zod' },
  ],
})
```

### src/client.ts（認証ラッパー）

```typescript
import { createClient } from './generated/client'

export function createBackendClient(options?: { accessToken?: string }) {
  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_PY_URL ?? 'http://127.0.0.1:4040',
  })

  if (options?.accessToken) {
    client.interceptors.request.use((request) => {
      request.headers.set('Authorization', `Bearer ${options.accessToken}`)
      return request
    })
  }

  return client
}
```

## 自動生成ファイル（編集禁止）

`src/generated/` 配下は毎回上書きされます。変更が必要な場合は `backend-py` の API 定義を修正してください。

## トラブルシューティング

### バックエンド未起動時

```
⚠️  Backend is not available. Skipping client generation.
ℹ️  Using existing generated files
```

### 型エラー発生時

```bash
devenv up                    # Supabase + backend-py 起動（devenv up -d）
bun run generate:api        # 再生成
type-check-frontend         # 検証
```
