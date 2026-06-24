# モノレポ + FSD 実装例

モノレポ共有パッケージと FSD レイヤーを組み合わせた実装例を紹介します。

---

## 典型的なページ実装

### Server Component（認証付きページ）

```typescript
// apps/web/src/views/dashboard/ui/DashboardPage.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

// モノレポ共有パッケージ
import { createClient } from '@workspace/client-supabase/server'
import type { Tables } from '@workspace/types/schema'

// FSD レイヤー
import { UserSettings } from './UserSettings'

type User = Tables<'users'>

export default async function DashboardPage() {
  await cookies() // キャッシュ無効化

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <UserSettings initialData={userData} userId={user.id} />
    </div>
  )
}
```

### Client Component（インタラクティブ部分）

```typescript
// apps/web/src/views/dashboard/ui/UserSettings.tsx
'use client'

import { useState } from 'react'

// モノレポ共有パッケージ
import { createClient } from '@workspace/client-supabase/client'
import { useMutation, useQueryClient } from '@workspace/query'
import { Button, Input, Card, CardContent } from '@workspace/ui/components'
import type { Tables } from '@workspace/types/schema'

// FSD レイヤー
import { useUserStore } from '@/entities/user'

type User = Tables<'users'>

interface UserSettingsProps {
  initialData: User | null
  userId: string
}

export function UserSettings({ initialData, userId }: UserSettingsProps) {
  const [displayName, setDisplayName] = useState(initialData?.display_name ?? '')
  const supabase = createClient()
  const queryClient = useQueryClient()
  const updateUser = useUserStore((state) => state.setUser)

  const mutation = useMutation({
    mutationFn: async (newName: string) => {
      const { data, error } = await supabase
        .from('users')
        .update({ display_name: newName })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      updateUser(data) // Zustand store 更新
      queryClient.invalidateQueries({ queryKey: ['user', userId] })
    },
  })

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="表示名"
        />
        <Button
          onClick={() => mutation.mutate(displayName)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? '保存中...' : '保存'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Provider 構成

```typescript
// apps/web/app/[locale]/layout.tsx
import { QueryProvider } from '@workspace/query'
import { AuthProvider } from '@workspace/auth'

export default function LocaleLayout({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryProvider>
  )
}
```

---

## FSD Feature + モノレポパッケージ

### Feature: 認証フォーム

```typescript
// apps/web/src/features/auth/ui/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'

// モノレポ共有パッケージ
import { Button } from '@workspace/ui/components'
import { Input } from '@workspace/ui/components'

// FSD 同一スライス
import { signInWithOtp } from '../api'
import type { AuthFormState } from '../model/types'

export function LoginForm() {
  const router = useRouter()

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    async (_prevState, formData) => {
      const email = formData.get('email') as string
      const result = await signInWithOtp(email)

      if ('error' in result) {
        return { success: false, message: result.error }
      }

      router.push(`/auth/verify?email=${encodeURIComponent(email)}`)
      return { success: true, message: 'OTPを送信しました' }
    },
    { success: false, message: '' }
  )

  return (
    <form action={formAction} className="space-y-4">
      <Input name="email" type="email" placeholder="メールアドレス" required />
      {state.message && (
        <p className={state.success ? 'text-green-500' : 'text-red-500'}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? '送信中...' : 'ログイン'}
      </Button>
    </form>
  )
}
```

### Feature: Server Action

```typescript
// apps/web/src/features/auth/api/signInWithOtp.ts
'use server'

// モノレポ共有パッケージ
import { createClient } from '@workspace/client-supabase/server'

export async function signInWithOtp(email: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    if (error) return { error: error.message }
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

---

## FSD Entity + モノレポパッケージ

```typescript
// apps/web/src/entities/user/model/types.ts

// モノレポ共有パッケージから型をインポート
import type { Tables } from '@workspace/types/schema'

export type User = Tables<'users'>
export type UserProfile = Tables<'user_profiles'>

export interface UserWithProfile {
  user: User
  profile: UserProfile | null
}
```

```typescript
// apps/web/src/entities/user/model/store.ts
import { create } from 'zustand'
import type { User, UserProfile } from './types'

interface UserState {
  user: User | null
  profile: UserProfile | null
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
}))
```

---

## TanStack Query + Supabase

```typescript
// apps/web/src/entities/user/api/userQueries.ts
'use client'

// モノレポ共有パッケージ
import { useQuery, useMutation, useQueryClient } from '@workspace/query'
import { createClient } from '@workspace/client-supabase/client'
import type { Tables } from '@workspace/types/schema'

type User = Tables<'users'>

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => [...userKeys.all, id] as const,
  profile: (id: string) => [...userKeys.detail(id), 'profile'] as const,
}

// Query Hook
export function useUser(userId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data as User
    },
  })
}

// Mutation Hook
export function useUpdateUser() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<User> }) => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data as User
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) })
    },
  })
}
```

---

## インポートパスまとめ

```typescript
// モノレポ共有パッケージ（@workspace/*）
import { useAuth } from '@workspace/auth'
import { useQuery, useMutation } from '@workspace/query'
import { Button, Card } from '@workspace/ui/components'
import { createClient } from '@workspace/client-supabase/server'
import type { Tables } from '@workspace/types/schema'

// FSD レイヤー（@/*）
import { HomePage } from '@/views/home'
import { Header } from '@/widgets/header'
import { LoginForm } from '@/features/auth'
import { useUserStore, UserAvatar } from '@/entities/user'
import { cn } from '@/shared/lib/utils'
```
