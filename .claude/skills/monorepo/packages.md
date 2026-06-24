# 共有パッケージ詳細

frontend/packages/ 内の各パッケージについて詳細に説明します。

---

## @workspace/auth

**目的**: 認証状態管理（Zustand + Supabase）

**配置**: `packages/auth/`

```
packages/auth/
├── store/
│   └── authStore.ts        # Zustand store
├── providers/
│   ├── AuthProvider.tsx    # Web用 Provider
│   └── native.ts           # React Native用
├── hooks/
│   ├── useAuth.ts
│   └── useRequireAuth.ts
├── types/
│   └── index.ts
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export { useAuth, useRequireAuth } from './hooks'
export { AuthProvider } from './providers/AuthProvider'
export { useAuthStore } from './store/authStore'
export type { AuthState, AuthUser } from './types'
```

**使用例**:
```typescript
import { useAuth, AuthProvider } from '@workspace/auth'

// Provider でラップ
<AuthProvider>
  <App />
</AuthProvider>

// フックで認証状態取得
const { user, isAuthenticated, signOut } = useAuth()
```

---

## @workspace/query

**目的**: TanStack Query v5 の SSR 対応ラッパー

**配置**: `packages/query/`

```
packages/query/
├── provider/
│   └── QueryProvider.tsx   # QueryClientProvider
├── client/
│   └── queryClient.ts      # SSR対応 QueryClient
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
// TanStack Query の re-export
export * from '@tanstack/react-query'

// カスタム
export { getQueryClient } from './client/queryClient'
export { QueryProvider } from './provider/QueryProvider'
```

**使用例**:
```typescript
import { useQuery, useMutation, QueryProvider } from '@workspace/query'

// Provider でラップ
<QueryProvider>
  <AuthProvider>
    <App />
  </AuthProvider>
</QueryProvider>

// クエリフック
const { data, isLoading } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => fetchUser(userId),
})
```

---

## @workspace/types

**目的**: Supabase 自動生成型定義

**配置**: `packages/types/`

```
packages/types/
├── schema.ts               # Supabase 生成型
├── api/
│   └── index.ts
├── generate.ts             # 型生成スクリプト
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export type { Database, Tables, Enums } from './schema'
export * from './api'
```

**使用例**:
```typescript
import type { Tables, Enums } from '@workspace/types/schema'

type User = Tables<'users'>
type UserProfile = Tables<'user_profiles'>
type UserStatus = Enums<'user_status'>
```

**型生成** (devenv tasks 経由):
```bash
devenv tasks run model:frontend       # Frontend types を再生成
devenv tasks run model:build          # 全 model 再生成 (frontend + functions)
```

---

## @workspace/ui

**目的**: shadcn/ui コンポーネント集

**配置**: `packages/ui/`

```
packages/ui/
├── components/
│   ├── ui/                 # Radix UI primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   └── index.ts            # Public API
├── lib/
│   ├── utils.ts
│   └── cn.ts
├── index.ts
└── package.json
```

**Public API**:
```typescript
// components/index.ts
export { Button } from './ui/button'
export { Card, CardContent, CardHeader, CardTitle } from './ui/card'
export { Input } from './ui/input'
// ...
```

**使用例**:
```typescript
import { Button, Card, Input } from '@workspace/ui/components'

<Card>
  <CardHeader>
    <CardTitle>タイトル</CardTitle>
  </CardHeader>
  <CardContent>
    <Input placeholder="入力" />
    <Button>送信</Button>
  </CardContent>
</Card>
```

**コンポーネント追加** (devenv shell 内で nlx 経由):
```bash
nlx shadcn@latest add button card input        # = bunx shadcn@latest add ...
```

---

## @workspace/client-supabase

**目的**: Supabase クライアント（Server/Browser/Native対応）

**配置**: `packages/client/supabase/`

```
packages/client/supabase/
├── client.ts               # Browser client
├── server.ts               # Server Component用
├── middleware.ts           # Next.js middleware
├── native.ts               # React Native用
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export { createClient } from './client'
export { createClient as createServerClient } from './server'
export { createMiddlewareClient } from './middleware'
export { createNativeClient } from './native'
```

**使用例**:
```typescript
// Server Component
import { createClient } from '@workspace/client-supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select()
}

// Client Component
import { createClient } from '@workspace/client-supabase/client'

const supabase = createClient()
```

---

## @workspace/app

**目的**: Web/Mobile で共有するビジネスロジック

**配置**: `packages/app/`

```
packages/app/
├── entities/
│   └── user/
│       └── index.ts
├── features/
│   └── auth/
│       └── index.ts
├── hooks/
│   └── useSupabaseQuery.ts
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export * from './entities/user'
export * from './features/auth'
export { useSupabaseMutation, useSupabaseQuery } from './hooks/useSupabaseQuery'
```

**使用例**:
```typescript
import { useSupabaseQuery } from '@workspace/app'

const { data } = useSupabaseQuery({
  queryKey: ['users'],
  table: 'users',
})
```

---

## パッケージ依存関係

```
@workspace/web (apps/web)
├── @workspace/auth
│   ├── @workspace/client-supabase
│   └── @workspace/types
├── @workspace/query
├── @workspace/ui
├── @workspace/app
│   ├── @workspace/auth
│   └── @workspace/client-supabase
└── @workspace/client-supabase
    └── @workspace/types

@workspace/mobile (apps/mobile)
├── @workspace/auth
├── @workspace/app
└── @workspace/client-supabase
```

---

## 新規パッケージ作成手順

### 1. ディレクトリ作成

```bash
mkdir -p frontend/packages/new-package
```

### 2. package.json 作成

```json
{
  "name": "@workspace/new-package",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts",
    "./*": "./*.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 3. index.ts（Public API）作成

```typescript
/**
 * New Package - Public API
 */
export { something } from './something'
export type { SomeType } from './types'
```

### 4. 他のパッケージから参照

```json
{
  "dependencies": {
    "@workspace/new-package": "workspace:*"
  }
}
```

### 5. bun install 実行

```bash
cd frontend && bun install
```
