# モノレポ + FSD 実装例

モノレポ共有パッケージと FSD レイヤーを組み合わせた実装例を紹介します。

---

## 典型的なページ実装

### Server Component（認証付きページ）

```typescript
// apps/web/src/views/dashboard/ui/DashboardPage.tsx
import { redirect } from 'next/navigation'

// モノレポ共有パッケージ
import type { Schema } from '@workspace/backend'

// Amplify サーバーコンテキスト（Cognito 認証）
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'
import { getCurrentUser } from 'aws-amplify/auth/server'
import { cookies } from 'next/headers'

// FSD レイヤー
import { UserSettings } from './UserSettings'

type User = Schema['User']['type']

export default async function DashboardPage() {
  const user = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (contextSpec) => getCurrentUser(contextSpec),
  }).catch(() => null)

  if (!user) redirect('/login')

  return (
    <div>
      <h1>Welcome, {user.signInDetails?.loginId}</h1>
      <UserSettings userId={user.userId} />
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
import { getDataClient } from '@workspace/data-client'
import { useMutation, useQueryClient } from '@workspace/query'
import { Button, Input, Card, CardContent } from '@workspace/ui/components'
import type { Schema } from '@workspace/backend'

// FSD レイヤー
import { useUserStore } from '@/entities/user'

type User = Schema['User']['type']

interface UserSettingsProps {
  userId: string
  initialName?: string
}

export function UserSettings({ userId, initialName = '' }: UserSettingsProps) {
  const [displayName, setDisplayName] = useState(initialName)
  const queryClient = useQueryClient()
  const updateUser = useUserStore((state) => state.setUser)

  const mutation = useMutation({
    mutationFn: async (newName: string) => {
      const { data, errors } = await getDataClient().models.User.update({
        id: userId,
        displayName: newName,
      })

      if (errors) throw new Error(errors.map((e) => e.message).join(', '))
      return data
    },
    onSuccess: (data) => {
      if (data) updateUser(data) // Zustand store 更新
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
import { requestEmailOtp } from '../api'
import type { AuthFormState } from '../model/types'

export function LoginForm() {
  const router = useRouter()

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    async (_prevState, formData) => {
      const email = formData.get('email') as string
      const result = await requestEmailOtp(email)

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

### Feature: Email OTP リクエスト（Cognito）

Cognito の passwordless Email OTP は `aws-amplify/auth` の `signIn`（クライアント側）で開始する。

```typescript
// apps/web/src/features/auth/api/requestEmailOtp.ts
'use client'

import { signIn } from 'aws-amplify/auth'

export async function requestEmailOtp(email: string) {
  try {
    // USER_AUTH フロー + EMAIL_OTP で OTP メールを送信
    await signIn({
      username: email,
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'EMAIL_OTP',
      },
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

検証ページでは `confirmSignIn({ challengeResponse: otp })` で OTP を確認し、再送は
`resendSignInCode()` を使う。

---

## FSD Entity + モノレポパッケージ

```typescript
// apps/web/src/entities/user/model/types.ts

// モノレポ共有パッケージから Schema 型をインポート
import type { Schema } from '@workspace/backend'

export type User = Schema['User']['type']
export type UserProfile = Schema['UserProfile']['type']

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

## TanStack Query + Amplify Data

```typescript
// apps/web/src/entities/user/api/userQueries.ts
'use client'

// モノレポ共有パッケージ
import { useQuery, useMutation, useQueryClient } from '@workspace/query'
import { getDataClient } from '@workspace/data-client'
import type { Schema } from '@workspace/backend'

type User = Schema['User']['type']

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => [...userKeys.all, id] as const,
  profile: (id: string) => [...userKeys.detail(id), 'profile'] as const,
}

// Query Hook
export function useUser(userId: string) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: async () => {
      const { data, errors } = await getDataClient().models.User.get({ id: userId })

      if (errors) throw new Error(errors.map((e) => e.message).join(', '))
      return data
    },
  })
}

// Mutation Hook
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<User> }) => {
      const { data, errors } = await getDataClient().models.User.update({
        id: userId,
        ...updates,
      })

      if (errors) throw new Error(errors.map((e) => e.message).join(', '))
      return data
    },
    onSuccess: (data) => {
      if (data) queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) })
    },
  })
}
```

---

## インポートパスまとめ

```typescript
// モノレポ共有パッケージ（@workspace/*）
import { useAuthUser } from '@workspace/auth'
import { useQuery, useMutation } from '@workspace/query'
import { Button, Card } from '@workspace/ui/components'
import { getDataClient } from '@workspace/data-client'
import type { Schema } from '@workspace/backend'

// FSD レイヤー（@/*）
import { HomePage } from '@/views/home'
import { Header } from '@/widgets/header'
import { LoginForm } from '@/features/auth'
import { useUserStore, UserAvatar } from '@/entities/user'
import { cn } from '@/shared/lib/utils'
```
