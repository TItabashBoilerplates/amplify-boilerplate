# Server / Client Components ガイド

Next.js App Router では Server Components がデフォルトです。

## コンポーネントの種類

| 種類 | ディレクティブ | 実行場所 | 用途 |
|------|--------------|---------|------|
| **Server Component** | なし（デフォルト） | サーバー | データフェッチ、DB アクセス |
| **Client Component** | `'use client'` | ブラウザ | インタラクティブな UI |

## Server Component

### 特徴

- サーバーでのみ実行
- データベース、API、環境変数に直接アクセス可能
- 機密情報をクライアントに送信しない
- JavaScript バンドルサイズを削減
- `useState`, `useEffect` などの React Hooks は使用不可

### 基本例

```typescript
// app/posts/page.tsx - Server Component（デフォルト）
export default async function PostsPage() {
  // サーバーで直接データベースにアクセス
  const posts = await db.posts.findMany()

  // 環境変数（NEXT_PUBLIC_ なし）にアクセス
  const apiSecret = process.env.API_SECRET

  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

### データフェッチ

```typescript
// Server Component での直接フェッチ
export default async function Page() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store', // 動的データ
    // または cache: 'force-cache' // 静的データ
  })
  const data = await res.json()

  return <DataDisplay data={data} />
}
```

## Client Component

### 特徴

- ブラウザで実行
- React Hooks (`useState`, `useEffect` など) が使用可能
- イベントハンドラが使用可能
- ブラウザ API (`localStorage`, `window` など) にアクセス可能

### 基本例

```typescript
// components/Counter.tsx
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

### フォーム処理

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      router.push('/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  )
}
```

## コンポジションパターン

### Server → Client データ渡し

```typescript
// app/products/page.tsx - Server Component
import { ProductFilter } from './product-filter'

export default async function ProductsPage() {
  // サーバーでデータ取得
  const products = await db.products.findMany()

  // Client Component に props として渡す
  return (
    <div>
      <h1>Products</h1>
      <ProductFilter products={products} />
    </div>
  )
}
```

```typescript
// app/products/product-filter.tsx - Client Component
'use client'

import { useState } from 'react'

interface Product {
  id: string
  name: string
  category: string
}

interface Props {
  products: Product[]
}

export function ProductFilter({ products }: Props) {
  const [filter, setFilter] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search products..."
      />
      <ul>
        {filtered.map(product => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 境界を下げる

Client Component は必要な部分だけに適用します。

```typescript
// ❌ Bad: ページ全体を Client Component に
'use client'

export default function Page() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <Header /> {/* 静的なのに Client に */}
      <MainContent /> {/* 静的なのに Client に */}
      <Counter count={count} setCount={setCount} />
    </div>
  )
}

// ✅ Good: インタラクティブな部分だけ Client Component
export default function Page() {
  return (
    <div>
      <Header /> {/* Server Component */}
      <MainContent /> {/* Server Component */}
      <Counter /> {/* Client Component */}
    </div>
  )
}

// Counter.tsx
'use client'
export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>
}
```

## Server Actions

Server Actions は `'use server'` でマークされた非同期関数です。

### 定義

```typescript
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  await db.posts.create({
    data: { title, content },
  })

  revalidatePath('/posts')
}
```

### Client Component から呼び出し

```typescript
// components/CreatePostForm.tsx
'use client'

import { createPost } from '@/app/actions'

export function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" />
      <textarea name="content" placeholder="Content" />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

### useActionState との組み合わせ

```typescript
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions'

export function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null)

  return (
    <form action={formAction}>
      <input name="title" placeholder="Title" disabled={isPending} />
      <textarea name="content" placeholder="Content" disabled={isPending} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Post'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  )
}
```

## ハイドレーションエラー回避

### mounted フラグパターン

```typescript
'use client'

import { useState, useEffect } from 'react'

export function ClientOnlyComponent() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // サーバーとクライアントで異なる出力を防ぐ
  if (!mounted) return null

  // ブラウザ API を安全に使用
  const theme = localStorage.getItem('theme')

  return <div>Theme: {theme}</div>
}
```

### Suspense との組み合わせ

```typescript
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      <StaticContent />
      <Suspense fallback={<Loading />}>
        <DynamicContent />
      </Suspense>
    </div>
  )
}
```

## 使い分けガイド

### Server Component を使うとき

- データベースへの直接アクセス
- 機密情報（API キー、トークン）の使用
- 大きな依存関係の使用（サーバーのみ）
- SEO が重要なコンテンツ

### Client Component を使うとき

- `useState`, `useEffect` などの Hooks
- イベントリスナー（`onClick`, `onChange` など）
- ブラウザ API（`localStorage`, `window` など）
- リアルタイム更新

## このプロジェクトでの推奨

```typescript
// ✅ 推奨パターン
// views/dashboard/ui/DashboardPage.tsx (Server Component)
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@workspace/client-supabase/server'
import { DashboardContent } from './DashboardContent'

export default async function DashboardPage() {
  await cookies() // キャッシュ無効化

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const { data } = await supabase.from('profiles').select('*').single()

  // Client Component に必要なデータのみ渡す
  return <DashboardContent user={user} profile={data} />
}

// views/dashboard/ui/DashboardContent.tsx (Client Component)
'use client'

import { useState } from 'react'

interface Props {
  user: User
  profile: Profile
}

export function DashboardContent({ user, profile }: Props) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? 'Cancel' : 'Edit Profile'}
      </button>
      {isEditing && <ProfileEditor profile={profile} />}
    </div>
  )
}
```
