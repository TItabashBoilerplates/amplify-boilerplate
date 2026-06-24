---
description: "Edge Functions standards for Deno and Supabase"
alwaysApply: false
globs: ["supabase/functions/**/*.ts"]
---
# Edge Functions Standards

## Architecture

- **Runtime**: Deno
- **API**: `Deno.serve`
- **TypeScript**: Strict mode

## Directory Structure

```
supabase/functions/
├── _shared/          # 共通コード（必須）
│   ├── supabase.ts   # Supabase client
│   ├── drizzle/      # Drizzle schema
│   ├── cors.ts       # CORS headers
│   └── types.ts      # 共通型
├── function-a/
│   └── index.ts
└── function-b/
    └── index.ts
```

## DRY Principle (MANDATORY)

| 対象 | 配置場所 |
|------|---------|
| Supabase client | `_shared/supabase.ts` |
| Drizzle schema | `_shared/drizzle/` |
| CORS | `_shared/cors.ts` |
| 型定義 | `_shared/types.ts` |

## Import Management

**必須**: `npm:` prefix を使用

```typescript
// CORRECT
import { createClient } from "npm:@supabase/supabase-js@^2"

// WRONG
import { createClient } from "jsr:@supabase/supabase-js"
```

## Error Handling

```typescript
// CORRECT: Type guard
const message = error instanceof Error ? error.message : 'Unknown error'

// WRONG
return new Response(error.message)  // unsafe
```

