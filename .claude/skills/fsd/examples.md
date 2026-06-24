# FSD 実装例

このドキュメントでは、このプロジェクトの実際の実装例を紹介します。

---

## Entity 実装例: User

### ディレクトリ構造

```
src/entities/user/
├── ui/
│   └── UserAvatar.tsx
├── model/
│   ├── types.ts
│   ├── store.ts
│   └── hooks.ts
└── index.ts
```

### model/types.ts

```typescript
import type { Tables } from '@workspace/types/schema'

/**
 * Supabase users テーブルの型
 */
export type User = Tables<'users'>

/**
 * Supabase user_profiles テーブルの型
 */
export type UserProfile = Tables<'user_profiles'>

/**
 * ユーザーとプロフィールを結合した型
 */
export interface UserWithProfile {
  user: User
  profile: UserProfile | null
}

/**
 * 認証ユーザー情報（Supabase Auth）
 */
export interface AuthUser {
  id: string
  email: string | undefined
  emailConfirmedAt: Date | null
  createdAt: Date
}
```

### model/store.ts

```typescript
import { create } from 'zustand'
import type { AuthUser, User, UserProfile } from './types'

interface UserState {
  authUser: AuthUser | null
  user: User | null
  profile: UserProfile | null
  setAuthUser: (authUser: AuthUser | null) => void
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  clear: () => void
}

export const useUserStore = create<UserState>((set) => ({
  authUser: null,
  user: null,
  profile: null,
  setAuthUser: (authUser) => set({ authUser }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  clear: () => set({ authUser: null, user: null, profile: null }),
}))
```

### index.ts（Public API）

```typescript
/**
 * User Entity - Public API
 *
 * ユーザーエンティティのパブリックAPIです。
 * Feature Sliced Designの原則に従い、エンティティの実装詳細を隠蔽し、
 * 明示的にエクスポートされたインターフェースのみを公開します。
 */

// Hooks
export { useAuthUser, useUser, useUserProfile, useUserWithProfile } from './model/hooks'

// Store
export { useUserStore } from './model/store'

// Types
export type { AuthUser, User, UserProfile, UserWithProfile } from './model/types'

// UI Components
export { UserAvatar } from './ui/UserAvatar'
```

---

## Feature 実装例: Auth

### ディレクトリ構造

```
src/features/auth/
├── ui/
│   ├── LoginForm.tsx
│   └── VerifyOTPForm.tsx
├── api/
│   ├── signInWithOtp.ts
│   ├── verifyOtp.ts
│   ├── resendOtp.ts
│   ├── signOut.ts
│   └── index.ts
├── model/
│   └── types.ts
└── index.ts
```

### api/signInWithOtp.ts（Server Action）

```typescript
'use server'

import { createClient } from '@workspace/client-supabase/server'

export async function signInWithOtp(email: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

### api/index.ts

```typescript
/**
 * Auth API - Public API
 *
 * 認証関連のServer Actionsをエクスポート
 */

export { resendOtp } from './resendOtp'
export { signInWithOtp } from './signInWithOtp'
export { signOut } from './signOut'
export { verifyOtp } from './verifyOtp'
```

### ui/LoginForm.tsx（Client Component）

```typescript
'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { signInWithOtp } from '../api'
import type { AuthFormState } from '../model/types'

export interface LoginFormProps {
  className?: string
}

export function LoginForm({ className }: LoginFormProps) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    async (_prevState, formData) => {
      const email = formData.get('email') as string

      if (!email) {
        return { success: false, message: 'メールアドレスを入力してください' }
      }

      const result = await signInWithOtp(email)

      if ('error' in result) {
        return { success: false, message: result.error }
      }

      // OTP検証ページへリダイレクト
      router.push(`/auth/verify?email=${encodeURIComponent(email)}`)
      return { success: true, message: 'OTPを送信しました' }
    },
    { success: false, message: '' }
  )

  return (
    <form action={formAction} className={className}>
      <Input
        name="email"
        type="email"
        placeholder="メールアドレス"
        required
      />
      {state.message && (
        <p className={state.success ? 'text-green-500' : 'text-red-500'}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? '送信中...' : 'ログイン'}
      </Button>
    </form>
  )
}
```

### index.ts（Public API）

```typescript
/**
 * Auth Feature - Public API
 *
 * 認証機能のパブリックAPIです。
 * Feature Sliced Designの原則に従い、実装詳細を隠蔽し、
 * 明示的にエクスポートされたインターフェースのみを公開します。
 */

// API (Server Actions)
export { resendOtp, signInWithOtp, signOut, verifyOtp } from './api'

// Types
export type { AuthFormState, LoginFormProps, VerifyOTPFormProps } from './model/types'

// UI Components
export { LoginForm } from './ui/LoginForm'
export { VerifyOTPForm } from './ui/VerifyOTPForm'
```

---

## Widget 実装例: Header

### ディレクトリ構造

```
src/widgets/header/
├── ui/
│   └── Header.tsx
└── index.ts
```

### ui/Header.tsx

```typescript
'use client'

export function Header() {
  return (
    <div className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Logo area */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <span className="text-lg font-black text-primary-foreground">A</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">App</h1>
      </div>

      {/* Navigation area */}
      <nav className="flex items-center gap-4">
        {/* Add navigation items here */}
      </nav>
    </div>
  )
}
```

### index.ts

```typescript
/**
 * Header Widget Public API
 */

export { Header } from './ui/Header'
```

---

## View 実装例: Home

### ディレクトリ構造

```
src/views/home/
├── ui/
│   ├── HomePage.tsx
│   └── LanguageSwitcher.tsx
└── index.ts
```

### ui/HomePage.tsx（Server Component）

```typescript
import { getTranslations } from 'next-intl/server'
import { Link } from '@/shared/lib/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

export default async function HomePage() {
  const t = await getTranslations('HomePage')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">{t('title')}</h1>
      <p className="mt-4 text-muted-foreground">{t('description')}</p>
      <LanguageSwitcher />
      <Link href="/dashboard" className="mt-8">
        {t('goToDashboard')}
      </Link>
    </main>
  )
}
```

### ui/LanguageSwitcher.tsx（Client Component）

```typescript
'use client'

import { Link, usePathname } from '@/shared/lib/i18n'

export function LanguageSwitcher() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2">
      <Link href={pathname} locale="en">
        English
      </Link>
      <Link href={pathname} locale="ja">
        日本語
      </Link>
    </div>
  )
}
```

### index.ts

```typescript
export { default as HomePage, default } from './ui/HomePage'
export { LanguageSwitcher } from './ui/LanguageSwitcher'
```

---

## 新規スライス作成テンプレート

### 新規 Entity テンプレート

```bash
# 1. ディレクトリ作成
mkdir -p src/entities/new-entity/{ui,model}

# 2. ファイル作成
touch src/entities/new-entity/ui/NewEntityComponent.tsx
touch src/entities/new-entity/model/types.ts
touch src/entities/new-entity/model/store.ts
touch src/entities/new-entity/model/hooks.ts
touch src/entities/new-entity/index.ts
```

### 新規 Feature テンプレート

```bash
# 1. ディレクトリ作成
mkdir -p src/features/new-feature/{ui,api,model}

# 2. ファイル作成
touch src/features/new-feature/ui/NewFeatureComponent.tsx
touch src/features/new-feature/api/newFeatureAction.ts
touch src/features/new-feature/api/index.ts
touch src/features/new-feature/model/types.ts
touch src/features/new-feature/index.ts
```

### 新規 Widget テンプレート

```bash
# 1. ディレクトリ作成
mkdir -p src/widgets/new-widget/ui

# 2. ファイル作成
touch src/widgets/new-widget/ui/NewWidget.tsx
touch src/widgets/new-widget/index.ts
```

### 新規 View テンプレート

```bash
# 1. ディレクトリ作成
mkdir -p src/views/new-view/ui

# 2. ファイル作成
touch src/views/new-view/ui/NewViewPage.tsx
touch src/views/new-view/index.ts
```

---

## インポートパスの使用例

```typescript
// Entities からのインポート
import { useUserStore, UserAvatar } from '@/entities/user'
import type { User, AuthUser } from '@/entities/user'

// Features からのインポート
import { LoginForm, signInWithOtp } from '@/features/auth'
import type { AuthFormState } from '@/features/auth'

// Widgets からのインポート
import { Header } from '@/widgets/header'

// Views からのインポート（通常はApp Routerから呼び出し）
import { HomePage } from '@/views/home'

// Shared からのインポート
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
```
