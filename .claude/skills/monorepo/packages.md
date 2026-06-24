# 共有パッケージ詳細

frontend/packages/ 内の各パッケージについて詳細に説明します。

---

## @workspace/auth

**目的**: 認証状態管理（Zustand + Amazon Cognito / Amplify Auth, Email OTP passwordless）

**配置**: `packages/auth/`

```
packages/auth/
├── store/
│   └── authStore.ts        # Zustand store
├── providers/
│   ├── AuthProvider.tsx    # Web用 Provider
│   └── native.ts           # React Native用 (NativeAuthProvider)
├── hooks/
│   ├── useAuthUser.ts
│   └── useIsAuthenticated.ts
├── types/
│   └── index.ts
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export { useAuthUser, useIsAuthenticated } from './hooks'
export { AuthProvider } from './providers/AuthProvider'
export { NativeAuthProvider } from './providers/native'
export { useAuthStore } from './store/authStore'
export type { AuthState, AuthUser } from './types'
```

**使用例**:
```typescript
import { AuthProvider, useAuthUser, useIsAuthenticated } from '@workspace/auth'

// Provider でラップ
<AuthProvider>
  <App />
</AuthProvider>

// フックで認証状態取得
const user = useAuthUser()
const isAuthenticated = useIsAuthenticated()

// 低レベルの認証操作は aws-amplify/auth を直接使う（passwordless Email OTP）
import { signIn, confirmSignIn, resendSignInCode, signOut } from 'aws-amplify/auth'

// 1. メールで OTP をリクエスト
await signIn({
  username: email,
  options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
})
// 2. ユーザーが入力した OTP を確認
await confirmSignIn({ challengeResponse: otpCode })
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

## @workspace/backend

**目的**: Amplify Gen2 バックエンド定義（auth / data / storage / functions）と、フロントで共有する
`Schema` 型の集約パッケージ。code-first スキーマ（`a.schema`）がデータモデルと型の単一の出所になる。

**配置**: `packages/backend/`

```
packages/backend/
├── amplify/
│   ├── backend.ts          # defineBackend({ auth, data, storage, api }) + SNS 配線
│   ├── auth/resource.ts    # Cognito（Email OTP）
│   ├── data/resource.ts    # AppSync + DynamoDB（a.schema, userPool 認可）
│   ├── storage/resource.ts # S3（非公開・path 単位アクセス）
│   └── functions/api/      # FastAPI を載せた Python Lambda（CDK）
├── index.ts                # Public API（Schema 型の re-export）
└── package.json
```

**Public API**:
```typescript
// data/resource.ts の a.schema から導出した Schema 型を公開
export type { Schema } from './amplify/data/resource'
```

**使用例**:
```typescript
import type { Schema } from '@workspace/backend'

type Todo = Schema['Todo']['type']
type User = Schema['User']['type']
```

**スキーマ反映 / 型生成** (devenv scripts 経由):
```bash
sandbox          # ampx sandbox（watch で amplify_outputs.json と Schema 型を生成・更新）
sandbox-once     # 1 回だけデプロイして amplify_outputs.json / 型を更新
```

---

## @workspace/data-client

**目的**: `generateClient<Schema>()` をラップした単一のデータアクセスクライアント。AppSync +
DynamoDB（Amplify Data）への型安全な CRUD を提供する（旧 Supabase クライアントの代替）。

**配置**: `packages/data-client/`

```
packages/data-client/
├── client.ts               # getDataClient (generateClient<Schema>() ラッパー)
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export { getDataClient } from './client'
```

**使用例**:
```typescript
import { getDataClient } from '@workspace/data-client'

// list / get / create / update / delete（models.<Model>.*）
const { data: todos } = await getDataClient().models.Todo.list()
const { data: todo } = await getDataClient().models.Todo.get({ id })
await getDataClient().models.Todo.create({ content: 'buy milk' })
```

> データの認可は `amplify/data/resource.ts` の `allow.owner()` / `allow.authenticated()` /
> `allow.guest()` で宣言する（RLS の代替。クエリ側で user 絞り込みを書かない）。

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
│   └── useDataQuery.ts
├── index.ts                # Public API
└── package.json
```

**Public API**:
```typescript
export * from './entities/user'
export * from './features/auth'
export { useDataMutation, useDataQuery } from './hooks/useDataQuery'
```

**使用例**:
```typescript
import { getDataClient } from '@workspace/data-client'
import { useDataQuery } from '@workspace/app'

const { data } = useDataQuery({
  queryKey: ['users'],
  queryFn: () => getDataClient().models.User.list(),
})
```

---

## パッケージ依存関係

```
@workspace/web (apps/web)
├── @workspace/auth          (Cognito)
├── @workspace/query
├── @workspace/ui
├── @workspace/app
│   ├── @workspace/auth
│   └── @workspace/data-client
└── @workspace/data-client
    └── @workspace/backend   (Schema 型)

@workspace/mobile (apps/mobile)
├── @workspace/auth
├── @workspace/app
└── @workspace/data-client
    └── @workspace/backend
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
