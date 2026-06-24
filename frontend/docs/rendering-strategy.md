# レンダリング戦略ガイド

このドキュメントでは、Next.js 16 + FSD アーキテクチャにおけるレンダリング戦略（SSR/SSG/CSR）の使い分けについて説明します。

## 概要

Next.js 16 の App Router では、以下の3つのレンダリング戦略を使用できます：

- **SSG（Static Site Generation）**: ビルド時にHTMLを生成
- **SSR（Server-Side Rendering）**: リクエストごとにサーバーでHTMLを生成
- **CSR（Client-Side Rendering）**: ブラウザでJavaScriptを実行してコンテンツを生成

## レンダリング戦略の選択基準

### SSG（Static Site Generation）

**使用ケース:**
- ログインを必要としないパブリックページ
- コンテンツがビルド時に確定している
- 高速なページロードが必要
- SEO対策が重要

**メリット:**
- 最高のパフォーマンス
- CDNでキャッシュ可能
- サーバー負荷が最小
- 優れたSEO

**実装方法:**

```tsx
// src/views/home/ui/HomePage.tsx
import { getTranslations } from 'next-intl/server'

/**
 * ホームページ（Server Component - SSG）
 */
export default async function HomePage() {
  const t = await getTranslations('HomePage')

  return (
    <div>
      <h1>{t('title')}</h1>
      {/* ... */}
    </div>
  )
}
```

**特徴:**
- `'use client'` ディレクティブを**使用しない**
- `async` 関数として実装
- `getTranslations` などのサーバー専用APIを使用
- ビルド出力: `●  (SSG)     prerendered as static HTML`

### 認証ページ（ログイン必要）の実装戦略

**Next.js公式ベストプラクティス: ハイブリッド（SSR + CSR）を使用**

ログインが必要なページでも、**Server Componentをベースにしたハイブリッド実装が標準**です。

---

#### 標準実装: ハイブリッド（SSR + CSR）【Next.js公式推奨】

**使用ケース:**
- ダッシュボード、設定ページ、プロフィールなど
- ほぼすべての認証が必要なページ
- Next.jsのベストプラクティスに従う場合

**メリット:**
- ✅ 初回ロードが高速（HTMLが即座に表示）
- ✅ サーバーで認証チェック（セキュリティ）
- ✅ SEO対策が可能
- ✅ データフェッチが簡潔
- ✅ Next.jsの設計思想に沿った実装

**Server/Client境界の管理:**
- 適切に設計すれば、境界管理は複雑ではない
- Hydrationエラーは正しいパターンで回避可能
- 公式ドキュメントに豊富な実装例がある

**実装方法:**

```tsx
// src/views/dashboard/ui/DashboardPage.tsx (Server Component)
import { createClient } from '@/shared/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { UserSettings } from './UserSettings'

export default async function DashboardPage() {
  // キャッシュ無効化（ユーザー固有データのため）
  await cookies()

  const supabase = createClient() // Supabase Server Client

  // 🔒 認証チェック（Supabase推奨: getUser()を使用）
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // サーバーでデータ取得
  const { data: userData } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>User ID: {user.id}</p>

      {/* インタラクティブな部分のみClient Component */}
      <UserSettings initialData={userData} userId={user.id} />
    </div>
  )
}
```

```tsx
// src/views/dashboard/ui/UserSettings.tsx (Client Component)
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/shared/lib/supabase/client'
import { useUserStore } from '@/entities/user/model/store'

export function UserSettings({ initialData, userId }) {
  const [settings, setSettings] = useState(initialData)
  const updateUser = useUserStore(state => state.updateUser) // Zustand
  const supabase = createBrowserClient() // Supabase Browser Client

  const handleUpdate = async () => {
    // Supabase Browser Clientでデータ更新
    const { data, error } = await supabase
      .from('user_profiles')
      .update(settings)
      .eq('id', userId)
      .select()
      .single()

    if (!error && data) {
      setSettings(data)
      updateUser(data) // Zustand状態更新
    }
  }

  return (
    <div>
      <button onClick={handleUpdate}>設定を保存</button>
    </div>
  )
}
```

**特徴:**
- ページ本体: Server Component（`async`関数、`'use client'`なし）
- インタラクティブ部分: Client Component（`'use client'`あり）
- ビルド出力: `ƒ  (Dynamic)  server-rendered on demand`

---

#### 特殊ケース: 完全CSR【非推奨、限定的な使用のみ】

**⚠️ 注意: このアプローチはNext.js公式では推奨されていません**

**使用が許容されるケース（非常に限定的）:**
- リアルタイムチャット、共同編集エディタなど、常時双方向通信が必要
- WebSocketやSSEで常時接続が必須
- SEOが完全に不要（社内ツール、管理画面など）
- サーバーレンダリングが技術的に困難な特殊な状況

**メリット:**
- ✅ 実装がシンプル（従来のReactパターン）
- ✅ Hydrationの概念が不要

**デメリット（重大）:**
- ❌ 初回ロードが遅い（JavaScriptダウンロード→実行→データ取得）
- ❌ サーバーサイドでの認証チェックが不可（**セキュリティリスク**）
- ❌ SEO対策が不可能
- ❌ Next.jsの設計思想に反する
- ❌ パフォーマンスが劣る

**実装方法:**

```tsx
// src/views/dashboard/ui/DashboardPage.tsx (Client Component)
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // クライアントサイドで認証チェック
    fetchUser()
      .then(data => {
        if (!data) {
          router.push('/login')
        } else {
          setUser(data)
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <Loading />
  if (!user) return null

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      {/* すべてがClient Componentなので自由に実装 */}
    </div>
  )
}
```

**特徴:**
- ページ全体: Client Component（`'use client'`あり）
- React Hooks（useState, useEffect等）を自由に使用
- ブラウザAPIへ直接アクセス可能

---

### 実装ガイドライン

**基本原則: 認証ページは常にハイブリッド（SSR + CSR）で実装**

| ページタイプ | 実装方法 | 理由 |
|------------|---------|------|
| ダッシュボード | ハイブリッド（SSR + CSR） | セキュリティ、パフォーマンス、SEO |
| ユーザー設定 | ハイブリッド（SSR + CSR） | サーバー認証、データ保護 |
| プロフィール | ハイブリッド（SSR + CSR） | SEO、初回ロード最適化 |
| 管理画面 | ハイブリッド（SSR + CSR） | セキュリティ重視 |
| リアルタイムチャット | 完全CSR（特殊ケース） | WebSocket常時接続が必須 |
| 共同編集エディタ | 完全CSR（特殊ケース） | 双方向通信が中心 |

**⚠️ 重要:** 「実装がシンプル」という理由だけで完全CSRを選択しないでください。ハイブリッド実装も、適切なパターンに従えば複雑ではありません。

### SSR（Server-Side Rendering）について

上記のアプローチAは、技術的にはSSR（Server-Side Rendering）の一種です。Next.js App Routerでは、Server Componentを使用することで、リクエストごとにサーバーでHTMLを生成します。

**特徴:**
- `'use client'` ディレクティブを**使用しない**
- `async` 関数として実装
- 動的データフェッチを使用
- ビルド出力: `ƒ  (Dynamic)  server-rendered on demand`

### CSR（Client-Side Rendering）

**使用ケース:**
- ユーザーインタラクションが多い
- リアルタイム更新が必要
- ブラウザAPIを使用
- 高度なアニメーション

**メリット:**
- インタラクティブなUI
- リアルタイム更新
- ブラウザAPIへのアクセス

**実装方法:**

```tsx
// src/features/chat/ui/ChatBox.tsx
'use client'

import { useState, useEffect } from 'react'

/**
 * チャットボックス（Client Component - CSR）
 */
export function ChatBox() {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    // WebSocketなどでリアルタイム更新
  }, [])

  return (
    <div>
      {/* ... */}
    </div>
  )
}
```

**特徴:**
- `'use client'` ディレクティブを**使用**
- React Hooks（useState, useEffect等）を使用
- ブラウザAPIへアクセス可能

## ハイブリッド戦略

実際のアプリケーションでは、Server ComponentsとClient Componentsを組み合わせて使用します。

### 推奨パターン

```tsx
// src/views/home/ui/HomePage.tsx (Server Component)
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from './LanguageSwitcher'

export default async function HomePage() {
  const t = await getTranslations('HomePage')

  return (
    <div>
      <h1>{t('title')}</h1>

      {/* インタラクティブな部分はClient Componentに分離 */}
      <LanguageSwitcher />
    </div>
  )
}
```

```tsx
// src/views/home/ui/LanguageSwitcher.tsx (Client Component)
'use client'

import { Link } from '@/shared/lib/i18n'

export function LanguageSwitcher() {
  return (
    <div>
      <Link href="/" locale="en">English</Link>
      <Link href="/" locale="ja">日本語</Link>
    </div>
  )
}
```

## Next.js + Supabase ベストプラクティス

このプロジェクトでは、**Next.js公式 + Supabase公式の両方のベストプラクティスに従った実装**を行います。

### Supabase クライアントの種類と使い分け

Supabaseは実行環境に応じて2種類のクライアントを提供しています（`@supabase/ssr` パッケージ）：

| クライアント | 使用場所 | 用途 |
|------------|---------|------|
| **Server Client** (`createClient`) | Server Component, Server Actions, Route Handlers | 認証チェック、保護されたデータ取得 |
| **Browser Client** (`createBrowserClient`) | Client Component | リアルタイム購読、クライアント側インタラクション |

### 認証チェックのベストプラクティス

**🔒 重要: 必ず `getUser()` を使用してください**

Supabase公式ドキュメントより：
> "Always use `supabase.auth.getUser()` to protect pages and user data. Never trust `supabase.auth.getSession()` inside server code."

**理由:**
- `getSession()`: クッキーベース（偽造可能） ❌
- `getUser()`: Supabase Auth serverで検証（安全） ✅

### 実装パターン: ハイブリッド（Server + Client）

#### パブリックページの例

```tsx
// src/views/blog/ui/BlogPage.tsx (Server Component)
import { createClient } from '@/shared/lib/supabase/server'

export default async function BlogPage() {
  const supabase = createClient() // Server Client

  // パブリックデータ取得
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)

  return <BlogList posts={posts} />
}
```

#### 認証ページの例（推奨パターン）

```tsx
// src/views/dashboard/ui/DashboardPage.tsx (Server Component)
import { createClient } from '@/shared/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  // キャッシュ無効化（ユーザー固有データのため）
  await cookies()

  const supabase = createClient() // Server Client

  // 🔒 認証チェック（Supabase推奨パターン）
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // 認証済みユーザーのデータ取得
  const { data: userData } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <h1>Welcome, {user.email}</h1>

      {/* インタラクティブ部分はClient Component */}
      <UserSettings initialData={userData} />
      <RealtimeNotifications userId={user.id} />
    </div>
  )
}
```

```tsx
// src/views/dashboard/ui/UserSettings.tsx (Client Component)
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/shared/lib/supabase/client'
import { useUserStore } from '@/entities/user/model/store'

export function UserSettings({ initialData }) {
  const [settings, setSettings] = useState(initialData)
  const updateUser = useUserStore(state => state.updateUser) // Zustand
  const supabase = createBrowserClient() // Browser Client

  const handleUpdate = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(settings)
      .eq('id', initialData.id)

    if (!error) {
      updateUser(data) // Zustand状態更新
    }
  }

  return (
    <div>
      <button onClick={handleUpdate}>設定を保存</button>
    </div>
  )
}
```

#### リアルタイム購読の例

```tsx
// src/features/notifications/ui/RealtimeNotifications.tsx (Client Component)
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/shared/lib/supabase/client'

export function RealtimeNotifications({ userId }) {
  const [notifications, setNotifications] = useState([])
  const supabase = createBrowserClient() // Browser Client

  useEffect(() => {
    // Supabase Realtime購読（Client Componentのみで可能）
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId, supabase])

  return (
    <div>
      {notifications.map(notification => (
        <div key={notification.id}>{notification.message}</div>
      ))}
    </div>
  )
}
```

### Zustand との統合

Zustand（状態管理）はClient Componentでのみ使用できます。Server Componentで取得したデータをpropsで渡し、Client ComponentでZustandストアに保存します。

```tsx
// src/entities/user/model/store.ts
import { create } from 'zustand'

interface UserStore {
  user: User | null
  updateUser: (user: User) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  updateUser: (user) => set({ user }),
}))
```

```tsx
// Client Componentでの使用例
'use client'

import { useEffect } from 'react'
import { useUserStore } from '@/entities/user/model/store'

export function UserProfile({ initialUser }) {
  const { user, updateUser } = useUserStore()

  useEffect(() => {
    // 初期データをZustandに保存
    if (initialUser) {
      updateUser(initialUser)
    }
  }, [initialUser, updateUser])

  return <div>{user?.name}</div>
}
```

### Hydrationエラーの完全回避ガイド（Supabase使用時）

**⚠️ 重要: Hydrationエラーを絶対に発生させない実装**

Supabase使用時に発生しやすいHydrationエラーと確実な回避方法を説明します。

#### パターン1: 認証状態の不一致 ❌ NG

**問題のあるコード:**
```tsx
// ❌ BAD: サーバーとクライアントで認証状態が異なる
export default async function Page() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      {user ? <p>Logged in as {user.email}</p> : <p>Not logged in</p>}
    </div>
  )
}
```

**問題点:** サーバーでは認証済み、クライアントでは未認証の場合にHTML不一致が発生

**✅ 正しい実装:**
```tsx
// ✅ GOOD: Server Componentで完結、または完全にClient Componentへ
export default async function Page() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 認証が必要なページならリダイレクト
  if (!user) redirect('/login')

  // 認証済み確定なので、安全にサーバーレンダリング
  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      {/* インタラクティブ部分はClient Component */}
      <UserMenu user={user} />
    </div>
  )
}
```

#### パターン2: データベースデータの条件分岐 ❌ NG

**問題のあるコード:**
```tsx
// ❌ BAD: サーバーとクライアントでデータが異なる可能性
export default async function ProfilePage() {
  const supabase = createClient()
  const { data: profile } = await supabase.from('profiles').select().single()

  return (
    <div>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} />
      ) : (
        <div>No avatar</div>
      )}
    </div>
  )
}
```

**問題点:** サーバーレンダリング後にデータが更新されるとHTML不一致

**✅ 正しい実装 方法1: Server Componentで完結**
```tsx
// ✅ GOOD: Server Componentでデータ取得、propsで渡す
export default async function ProfilePage() {
  const supabase = createClient()
  const { data: profile } = await supabase.from('profiles').select().single()

  // Server ComponentでHTMLを確定
  return (
    <div>
      <h1>Profile</h1>
      {/* データはサーバーで確定しているのでHydration安全 */}
      {profile?.avatar_url && <img src={profile.avatar_url} />}
      {!profile?.avatar_url && <div>No avatar</div>}

      {/* 更新機能はClient Component */}
      <AvatarUploader currentUrl={profile?.avatar_url} />
    </div>
  )
}
```

**✅ 正しい実装 方法2: Client Componentに分離**
```tsx
// Server Component: データ取得のみ
export default async function ProfilePage() {
  const supabase = createClient()
  const { data: profile } = await supabase.from('profiles').select().single()

  return (
    <div>
      <h1>Profile</h1>
      {/* Client Componentでレンダリング（useEffect後） */}
      <ProfileContent initialProfile={profile} />
    </div>
  )
}

// Client Component: 条件分岐はクライアントで
'use client'
export function ProfileContent({ initialProfile }) {
  const [profile, setProfile] = useState(initialProfile)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null // Hydration回避

  return (
    <>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} />
      ) : (
        <div>No avatar</div>
      )}
    </>
  )
}
```

#### パターン3: リアルタイムデータ ❌ NG

**問題のあるコード:**
```tsx
// ❌ BAD: Server Componentでリアルタイムデータを扱う
export default async function NotificationsPage() {
  const supabase = createClient()
  const { data: notifications } = await supabase
    .from('notifications')
    .select()

  return (
    <div>
      {notifications.map(n => <div key={n.id}>{n.message}</div>)}
    </div>
  )
}
```

**問題点:** ページロード後に新しい通知が追加されるとHTML不一致

**✅ 正しい実装:**
```tsx
// Server Component: 初期データのみ取得
export default async function NotificationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 初期データ取得（オプション）
  const { data: initialNotifications } = await supabase
    .from('notifications')
    .select()
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <h1>Notifications</h1>
      {/* Client ComponentでRealtimeを処理 */}
      <NotificationsList
        initialNotifications={initialNotifications}
        userId={user.id}
      />
    </div>
  )
}

// Client Component: Realtimeはここで
'use client'
export function NotificationsList({ initialNotifications, userId }) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [mounted, setMounted] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    setMounted(true)

    // Realtime購読
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => channel.unsubscribe()
  }, [userId])

  if (!mounted) return null // Hydration回避

  return (
    <div>
      {notifications.map(n => (
        <div key={n.id}>{n.message}</div>
      ))}
    </div>
  )
}
```

#### パターン4: 日時・ランダム値 ❌ NG

**問題のあるコード:**
```tsx
// ❌ BAD: サーバーとクライアントで異なる値
export default function PostCard({ post }) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at))

  return <div>Posted {timeAgo}</div>
}
```

**✅ 正しい実装:**
```tsx
// ✅ GOOD: Client Componentで日時処理
'use client'
export function PostCard({ post }) {
  const [mounted, setMounted] = useState(false)
  const [timeAgo, setTimeAgo] = useState('')

  useEffect(() => {
    setMounted(true)
    setTimeAgo(formatDistanceToNow(new Date(post.created_at)))
  }, [post.created_at])

  if (!mounted) return <div>Loading...</div>

  return <div>Posted {timeAgo}</div>
}
```

### Hydration回避のゴールデンルール

1. **Server Componentは静的データのみ** - サーバーで確定したデータのみレンダリング
2. **動的・リアルタイムはClient Component** - 変化する可能性があるデータはすべてClient Component
3. **`mounted` フラグ必須** - Client Componentでブラウザ依存処理をする場合は必ず使用
4. **条件分岐は慎重に** - サーバーとクライアントで結果が変わる可能性がある条件分岐は避ける
5. **初期データはpropsで渡す** - Server Componentで取得したデータはpropsでClient Componentへ

### セキュリティとパフォーマンスの考慮事項

1. **認証チェック**: 必ずServer Componentで `getUser()` を使用
2. **キャッシュ制御**: 認証ページでは `cookies()` を呼び、Next.jsキャッシュを無効化
3. **データ最小化**: Client Componentには必要最小限のデータのみを渡す
4. **環境変数**: `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
5. **Hydration安全性**: サーバーとクライアントで同じHTMLが生成されることを保証

### 使い分けマトリックス

| 機能 | 実装場所 | 使用技術 | 理由 |
|------|---------|---------|------|
| 認証チェック | Server Component | `supabase.auth.getUser()` | セキュリティ（偽造不可） |
| 初期データ取得 | Server Component | Server Client | パフォーマンス（SSR） |
| リアルタイム購読 | Client Component | Browser Client | Supabase Realtime専用 |
| 状態管理 | Client Component | Zustand | クライアント状態管理 |
| フォーム送信 | Client Component → Server Action | Server Client | セキュリティ |
| インタラクティブUI | Client Component | Browser Client + Zustand | ユーザー操作 |

## プロジェクトにおける実装ガイドライン

### 基本原則（Next.js公式ベストプラクティス準拠）

1. **パブリックページ（ログイン不要）は必ずSSG/SSR**
   - `'use client'`を使用しない
   - Server Componentで実装
   - SEO対策とパフォーマンスの両立

2. **認証ページ（ログイン必要）はハイブリッド（SSR + CSR）を標準とする**
   - **標準実装**: ハイブリッド（SSR + CSR）
     - ページ本体: Server Component（`async`関数、認証チェック）
     - インタラクティブ部分: Client Component
     - セキュリティ、パフォーマンス、SEOを重視
   - **特殊ケースのみ**: 完全CSR
     - リアルタイムチャット、共同編集など
     - WebSocket/SSE常時接続が必須の場合のみ
     - ⚠️ 単に「実装がシンプル」という理由では使用しない

3. **インタラクティブなコンポーネントはClient Component**
   - `'use client'`を明示的に宣言
   - React Hooksを自由に使用
   - ブラウザAPIへアクセス可能

4. **デフォルトはServer Component**
   - 迷ったらServer Componentから始める
   - 必要に応じてClient Componentに分離

### FSDレイヤーごとの推奨戦略

#### Views レイヤー（`src/views/`）

- **パブリックページ**: SSG/SSR（Server Component） - 必須
- **認証後ページ**: ハイブリッド（SSR + CSR）（Server Component） - 標準
- **特殊なページ**: 完全CSR（Client Component） - リアルタイム双方向通信が必須の場合のみ
- インタラクティブな部分は別のClient Componentに分離

#### Features レイヤー（`src/features/`）

- **基本**: Client Component（`'use client'`）
- ユーザーアクションを処理するため、通常はCSRが適切

#### Widgets レイヤー（`src/widgets/`）

- **ケースバイケース**: Server ComponentまたはClient Component
- 静的なヘッダー/フッター: Server Component
- インタラクティブなナビゲーション: Client Component

#### Entities レイヤー（`src/entities/`）

- **表示専用**: Server Component
- **インタラクティブ**: Client Component

#### Shared レイヤー（`src/shared/ui/`）

- **基本**: 両方に対応できるように設計
- shadcn/uiコンポーネント: Client Componentとして実装されている

## ビルド出力の確認

ビルド時に表示される記号の意味：

```
Route (app)
┌ ○ /                    # Static（SSG）
├ ●  /[locale]           # SSG with generateStaticParams
├ ƒ  /dashboard          # Dynamic（SSR）
└ ○  /_not-found         # Static（SSG）

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

## パフォーマンス最適化

### SSGの最適化

```tsx
// generateStaticParams を使用して事前生成
export async function generateStaticParams() {
  return [
    { locale: 'en' },
    { locale: 'ja' },
  ]
}
```

### SSRの最適化

```tsx
// キャッシュを活用
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 } // 60秒ごとに再検証
})
```

### CSRの最適化

```tsx
'use client'

import dynamic from 'next/dynamic'

// 動的インポートでバンドルサイズを削減
const HeavyComponent = dynamic(() => import('./HeavyComponent'))
```

## トラブルシューティング

### Hydrationエラーの診断と解決（Supabase使用時）

**⚠️ Hydrationエラーは絶対に避けてください**

Hydrationエラーは、サーバーでレンダリングされたHTMLとクライアントでレンダリングされたHTMLが一致しない場合に発生します。

**エラー例:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
Error: There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.
```

#### Supabase使用時の主な原因と完全な解決策

#### 1. 認証状態の条件分岐（最も多い原因）

**❌ 問題:**
```tsx
// Hydrationエラーが発生する
export default async function Page() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      {user ? <p>Logged in</p> : <p>Not logged in</p>}
    </div>
  )
}
```

**✅ 解決策: redirect()を使用**
```tsx
export default async function Page() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 条件分岐せず、リダイレクト
  if (!user) redirect('/login')

  // ここに到達するのは認証済みユーザーのみ
  return <div>Logged in as {user.email}</div>
}
```

#### 2. Supabase Realtimeデータの直接使用

**❌ 問題:**
```tsx
// Server Componentでリアルタイムデータを扱おうとする
export default async function Page() {
  const { data } = await supabase.from('posts').select()
  // ページロード後にデータが変わるとHydrationエラー
  return <div>{data.map(...)}</div>
}
```

**✅ 解決策: Client Componentに分離 + mounted guard**
```tsx
// Server Component
export default async function Page() {
  const { data: initial } = await supabase.from('posts').select()
  return <PostsList initialData={initial} />
}

// Client Component
'use client'
export function PostsList({ initialData }) {
  const [posts, setPosts] = useState(initialData)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const channel = supabase.channel('posts')
      .on('postgres_changes', ...)
      .subscribe()
    return () => channel.unsubscribe()
  }, [])

  if (!mounted) return null // Hydration完了まで待つ
  return <>{posts.map(...)}</>
}
```

#### 3. 日時・相対時間の表示

**❌ 問題:**
```tsx
// サーバーとクライアントで時間が異なる
export default function PostCard({ post }) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at))
  return <div>Posted {timeAgo}</div>
}
```

**✅ 解決策: Client Component + mounted guard**
```tsx
'use client'
export function PostCard({ post }) {
  const [mounted, setMounted] = useState(false)
  const [timeAgo, setTimeAgo] = useState('')

  useEffect(() => {
    setMounted(true)
    setTimeAgo(formatDistanceToNow(new Date(post.created_at)))
  }, [post.created_at])

  if (!mounted) return <div>Loading...</div>
  return <div>Posted {timeAgo}</div>
}
```

#### 4. ブラウザ専用API (window, localStorage等)

**❌ 問題:**
```tsx
export default function Component() {
  const width = window.innerWidth
  return <div>{width}</div>
}
```

**✅ 解決策: Client Component + mounted guard**
```tsx
'use client'
export function Component() {
  const [width, setWidth] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setWidth(window.innerWidth)
  }, [])

  if (!mounted) return null
  return <div>{width}</div>
}
```

#### 5. HTML構造の不一致

**❌ 問題:**
```tsx
// 無効なHTML構造
export default function Component() {
  return (
    <p>
      <div>Nested div in p tag</div>
    </p>
  )
}
```

**✅ 解決策: 正しいHTML構造**
```tsx
export default function Component() {
  return (
    <div>
      <p>Paragraph text</p>
      <div>Nested div</div>
    </div>
  )
}
```

#### Hydrationエラーのデバッグ手順

1. **エラーメッセージを確認**: ブラウザコンソールで具体的な不一致箇所を特定
2. **React DevToolsを使用**: コンポーネントツリーで `'use client'` の境界を確認
3. **mounted guardを追加**: 疑わしいClient Componentに `mounted` フラグを追加
4. **条件分岐を確認**: Server Componentの条件分岐を `redirect()` に置き換え
5. **データフローを確認**: Server → Client へのprops渡しが正しいか確認

#### ⚠️ suppressHydrationWarning は使用しない

```tsx
// ❌ 絶対に使わない - 問題を隠すだけ
<div suppressHydrationWarning>
  {new Date().toLocaleString()}
</div>
```

**理由:** 根本的な解決にならず、将来のバグの原因になります。必ず上記の正しい方法で修正してください。

### 「'use client'が必要」エラー

**エラー:**
```
Error: useState can only be used in Client Components
```

**解決策:**
- コンポーネントの先頭に`'use client'`を追加
- または、React Hooksを使用している部分を別のClient Componentに分離

### SSGなのにSSRになる

**原因:**
- 動的データフェッチを使用している
- リクエストヘッダーやクッキーを読み取っている

**解決策:**
- `generateStaticParams`を使用
- キャッシュ設定を見直す

### パフォーマンスが悪い

**原因:**
- Client Componentを過度に使用
- バンドルサイズが大きい

**解決策:**
- Server Componentを優先
- 動的インポートを使用
- バンドルサイズを分析（`bun run build`で確認）

## ベストプラクティス

1. **Server Component を優先する**
   - デフォルトでServer Component
   - 必要な場合のみClient Component

2. **境界を明確にする**
   - Server ComponentとClient Componentの境界を明確に
   - `'use client'`の配置を最小限に

3. **データフェッチを最適化する**
   - Server Componentでデータを取得
   - Client Componentにpropsとして渡す

4. **Hydrationエラーを防ぐ**
   - サーバーとクライアントで同じHTMLを生成する
   - 動的な値（日時、ランダム値）はClient Componentで処理
   - ブラウザAPI（window, localStorage）はuseEffect内で使用
   - 正しいHTML構造を維持（pタグの中にdivタグなど禁止）
   - 適切なパターンに従えば、Hydrationエラーは回避可能

5. **認証ページは常にハイブリッド実装を標準とする**
   - ページ本体: Server Component（認証チェック、データ取得）
   - インタラクティブ部分: Client Component
   - ⚠️ 完全CSRは特殊ケース（リアルタイム双方向通信）のみ
   - Next.js公式ベストプラクティスに準拠

6. **パフォーマンスを測定する**
   - ビルド出力を確認
   - Lighthouse等でパフォーマンスを測定

7. **ドキュメント化する**
   - 各ページのレンダリング戦略を明記
   - コメントで理由を説明

## 参考資料

- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Static Site Generation](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic)
