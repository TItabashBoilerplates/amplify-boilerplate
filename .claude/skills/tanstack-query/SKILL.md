---
name: tanstack-query
description: TanStack Query v5 によるサーバー状態管理ガイダンス。useQuery、useMutation、QueryClient、キャッシュ無効化、Supabase連携についての質問に使用。クエリキー設計、SSR対応、FSD配置方針の実装支援を提供。
---

# TanStack Query v5 スキル

このプロジェクトは **TanStack Query v5** を使用してサーバー状態を管理しています。

## 状態管理の役割分担

| 状態タイプ | 説明 | 管理方法 |
|-----------|------|----------|
| **ローカルUI状態** | モーダル開閉、フォーム入力 | `useState` |
| **グローバル共有状態** | 認証セッション | Zustand (`@workspace/auth`) |
| **サーバー状態** | DBデータ、API応答 | **TanStack Query** (`@workspace/query`) |

## パッケージ構成

```
frontend/packages/query/
├── index.ts                  # Public API（re-exports）
├── provider/
│   └── QueryProvider.tsx     # QueryClientProvider ラッパー
└── client/
    └── queryClient.ts        # SSR対応 QueryClient
```

## 基本的な使い方

### Query（データ取得）

```typescript
'use client'
import { useQuery } from '@workspace/query'
import { createClient } from '@workspace/client-supabase/client'

export function useUserProfile(userId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['users', userId, 'profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    },
    staleTime: 60 * 1000, // 1分間はstale判定しない
  })
}
```

### Mutation（データ更新）

```typescript
'use client'
import { useMutation, useQueryClient } from '@workspace/query'
import { createClient } from '@workspace/client-supabase/client'

export function useUpdateUserProfile() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, updates }) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data, { userId }) => {
      // キャッシュを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ['users', userId] })
    },
  })
}
```

## Query Key 設計

階層的なキー設計を推奨：

```typescript
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: string) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  profile: (id: string) => [...userKeys.detail(id), 'profile'] as const,
}

// 使用例
queryClient.invalidateQueries({ queryKey: userKeys.all })        // 全ユーザーデータ
queryClient.invalidateQueries({ queryKey: userKeys.detail(id) }) // 特定ユーザー
```

## FSD 配置方針

| FSDレイヤー | TanStack Query 配置 |
|------------|---------------------|
| **shared/api** | 共通 Query Key ファクトリ |
| **entities/*/api** | エンティティの CRUD クエリ |
| **features/*/api** | フィーチャー固有のクエリ |

## Provider 設定

```typescript
// app/[locale]/layout.tsx
import { QueryProvider } from '@workspace/query'
import { AuthProvider } from '@workspace/auth'

export default function Layout({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryProvider>
  )
}
```

## SSR 注意事項

- QueryClient は各リクエストで新規作成（キャッシュ共有を防ぐ）
- `staleTime` を設定してクライアントでの即座の再取得を防ぐ
- Server Component でのプリフェッチは HydrationBoundary を使用

## DevTools

開発環境では **ReactQueryDevtools** が自動表示されます。

詳細: [examples.md](examples.md)
