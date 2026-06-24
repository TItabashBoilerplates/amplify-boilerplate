# FSD セグメント詳細

このドキュメントでは、スライス内のセグメント構成について詳細に説明します。

## セグメント概要

このプロジェクトでは以下の3つのセグメントを使用しています:

| セグメント | 用途 | ファイル例 |
|-----------|------|-----------|
| **ui/** | Reactコンポーネント | `*.tsx` |
| **api/** | Server Actions、API呼び出し | `*.ts` |
| **model/** | 型定義、状態管理、ビジネスロジック | `types.ts`, `store.ts`, `hooks.ts` |

---

## ui/ セグメント

**目的**: Reactコンポーネントの配置

**配置するもの**:
- React関数コンポーネント
- Client Components（`'use client'`）
- Server Components

**命名規則**:
- PascalCase: `UserAvatar.tsx`, `LoginForm.tsx`
- コンポーネント名とファイル名を一致させる

**実装パターン**:

```typescript
// Client Component
'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'

interface LoginFormProps {
  className?: string
}

export function LoginForm({ className }: LoginFormProps) {
  const [email, setEmail] = useState('')

  return (
    <form className={className}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit">送信</Button>
    </form>
  )
}
```

```typescript
// Server Component
import { getTranslations } from 'next-intl/server'

export default async function HomePage() {
  const t = await getTranslations('HomePage')
  return <h1>{t('title')}</h1>
}
```

---

## api/ セグメント

**目的**: Server Actions、API呼び出し、データ取得処理

**配置するもの**:
- Server Actions（`'use server'`）
- API呼び出し関数
- データフェッチロジック

**命名規則**:
- camelCase: `signInWithOtp.ts`, `verifyOtp.ts`
- 動詞から始める: `get*`, `create*`, `update*`, `delete*`, `sign*`

**必須**: `index.ts` でPublic APIをエクスポート

**実装パターン**:

```typescript
// api/signInWithOtp.ts - Server Action
'use server'

import { createClient } from '@workspace/client-supabase/server'

export async function signInWithOtp(email: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
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

```typescript
// api/index.ts - Public API
export { signInWithOtp } from './signInWithOtp'
export { verifyOtp } from './verifyOtp'
export { signOut } from './signOut'
```

---

## model/ セグメント

**目的**: 型定義、状態管理、ビジネスロジック

**配置するもの**:
- 型定義 (`types.ts`)
- Zustandストア (`store.ts`)
- カスタムフック (`hooks.ts`)
- ビジネスロジック関数

**命名規則**:
- `types.ts` - 型定義
- `store.ts` - Zustandストア
- `hooks.ts` - カスタムフック

### types.ts

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

### store.ts

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

### hooks.ts

```typescript
import { useUserStore } from './store'
import type { AuthUser, User, UserProfile } from './types'

/**
 * 認証ユーザー情報を取得するフック
 */
export function useAuthUser(): AuthUser | null {
  return useUserStore((state) => state.authUser)
}

/**
 * ユーザー情報を取得するフック
 */
export function useUser(): User | null {
  return useUserStore((state) => state.user)
}

/**
 * ユーザープロフィールを取得するフック
 */
export function useUserProfile(): UserProfile | null {
  return useUserStore((state) => state.profile)
}
```

---

## セグメント組み合わせパターン

### Entity（例: user）

```
entities/user/
├── ui/
│   └── UserAvatar.tsx      # ユーザーアバター表示
├── model/
│   ├── types.ts            # 型定義
│   ├── store.ts            # Zustand store
│   └── hooks.ts            # カスタムフック
└── index.ts                # Public API
```

### Feature（例: auth）

```
features/auth/
├── ui/
│   ├── LoginForm.tsx       # ログインフォーム
│   └── VerifyOTPForm.tsx   # OTP検証フォーム
├── api/
│   ├── signInWithOtp.ts    # Server Action
│   ├── verifyOtp.ts
│   ├── signOut.ts
│   └── index.ts            # API Public API
├── model/
│   └── types.ts            # フォーム状態型
└── index.ts                # Feature Public API
```

### Widget（例: header）

```
widgets/header/
├── ui/
│   └── Header.tsx          # ヘッダーコンポーネント
└── index.ts                # Public API
```

### View（例: home）

```
views/home/
├── ui/
│   ├── HomePage.tsx        # ホームページ（Server Component）
│   └── LanguageSwitcher.tsx
└── index.ts                # Public API
```

---

## Public API（index.ts）の重要性

**すべてのスライスで `index.ts` は必須です**

```typescript
// entities/user/index.ts
/**
 * User Entity - Public API
 *
 * Feature Sliced Designの原則に従い、実装詳細を隠蔽し、
 * 明示的にエクスポートされたインターフェースのみを公開します。
 */

// Hooks
export { useAuthUser, useUser, useUserProfile } from './model/hooks'

// Store
export { useUserStore } from './model/store'

// Types
export type { AuthUser, User, UserProfile } from './model/types'

// UI Components
export { UserAvatar } from './ui/UserAvatar'
```

**メリット**:
1. **カプセル化**: 内部実装の隠蔽
2. **保守性**: 変更の影響範囲を限定
3. **可読性**: 利用可能なAPIが明確
4. **リファクタリング容易性**: 内部構造の変更が外部に影響しない
