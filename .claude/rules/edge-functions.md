---
paths: supabase/functions/**/*.ts
---

# Edge Functions Code Standards

## Architecture

- **Runtime**: Deno
- **API**: Native `Deno.serve`
- **TypeScript**: Strict mode

## Directory Structure

```
supabase/functions/
├── _shared/              # 共通コード（必須）
│   ├── supabase.ts       # Supabase クライアント
│   ├── drizzle/          # Drizzle スキーマ
│   ├── cors.ts           # CORS ヘッダー
│   └── types.ts          # 共通型定義
├── function-a/
│   └── index.ts
└── function-b/
    └── index.ts
```

## DRY Principle (MANDATORY)

**重複実装は徹底的に排除し、コードをクリーンに保つ。**

### 共通化の原則

| 対象 | 配置場所 | 例 |
|------|---------|-----|
| **Supabase クライアント** | `_shared/supabase.ts` | createClient 初期化 |
| **Drizzle スキーマ** | `_shared/drizzle/` | テーブル定義、型 |
| **CORS 設定** | `_shared/cors.ts` | ヘッダー定義 |
| **共通型定義** | `_shared/types.ts` | リクエスト/レスポンス型 |
| **ユーティリティ** | `_shared/utils.ts` | 共通ヘルパー関数 |

### 禁止事項

```typescript
// ❌ Bad: 各関数で Supabase クライアントを個別に初期化
// function-a/index.ts
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)
// function-b/index.ts (同じコード重複)
const supabase = createClient(...)

// ✅ Good: _shared で共通化
// _shared/supabase.ts
export const supabase = createClient(...)
// function-a/index.ts
import { supabase } from "../_shared/supabase.ts"
```

```typescript
// ❌ Bad: CORS ヘッダーを各関数で重複定義
// function-a/index.ts
const corsHeaders = { "Access-Control-Allow-Origin": "*", ... }
// function-b/index.ts
const corsHeaders = { "Access-Control-Allow-Origin": "*", ... }

// ✅ Good: _shared で共通化
// _shared/cors.ts
export const corsHeaders = { ... }
```

### チェックリスト

新しい Edge Function を作成する前に確認：

1. **_shared に同様の機能があるか？** → あれば再利用
2. **他の関数でも使う可能性があるか？** → _shared に実装
3. **型定義が重複していないか？** → _shared/types.ts に共通化
4. **Drizzle スキーマを使用するか？** → _shared/drizzle/ から import

## Import Management

**MANDATORY**: Use `npm:` prefix for npm packages, **EXCEPT for postgres.js**.

```typescript
// ✅ Good: npm: prefix for most packages
import { createClient } from "npm:@supabase/supabase-js@^2"
import type { InferSelectModel } from "npm:drizzle-orm"

// ✅ Good: deno.land/x for postgres.js (Deno 互換性のため)
import postgres from "postgres"  // deno.json の import map 経由

// ❌ Bad: JSR imports
import { createClient } from "jsr:@supabase/supabase-js"

// ❌ Bad: npm:postgres (Deno 環境で互換性問題あり)
import postgres from "npm:postgres"
```

## deno.json Configuration

**MANDATORY**: postgres.js は `deno.land/x` から最新版を使用すること。

```json
{
  "imports": {
    "drizzle-orm": "npm:drizzle-orm@^0.45.2",
    "drizzle-orm/": "npm:drizzle-orm@^0.45.2/",
    "postgres": "https://deno.land/x/postgresjs@v3.4.8/mod.js"
  }
}
```

**IMPORTANT**:
- `postgres`: **必ず** `https://deno.land/x/postgresjs@v3.4.8/mod.js` を使用
- `npm:postgres` は Deno 環境で互換性問題が発生するため**禁止**
- バージョンは `v3.4.8` を維持（Deno での動作確認済み）

## Error Handling

Use type guards for error handling:

```typescript
// ✅ Good: Type guard
try {
  // ...
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  })
}

// ❌ Bad: Unsafe error access
catch (error) {
  return new Response(error.message)  // error might not have message
}
```

## Drizzle Schema Usage

**型のみ使用する場合**:
```typescript
import type { InferSelectModel, InferInsertModel } from "drizzle-orm"
import { generalUsers } from "../shared/drizzle/index.ts"

type User = InferSelectModel<typeof generalUsers>
type NewUser = InferInsertModel<typeof generalUsers>
```

**クエリ実行する場合（postgres.js + Drizzle）**:
```typescript
// shared/db.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./drizzle/index.ts"

const connectionString = Deno.env.get("SUPABASE_DB_URL")!
const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client, { schema })

// function-a/index.ts
import { db } from "../shared/db.ts"
import { generalUsers } from "../shared/drizzle/index.ts"
import { eq } from "drizzle-orm"

const users = await db.select().from(generalUsers).where(eq(generalUsers.id, userId))
```

**IMPORTANT**: `postgres()` の引数に `{ prepare: false }` を必ず指定すること（Supabase Pooler との互換性のため）。

## Response Format

Always include proper headers:

```typescript
return new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})
```
