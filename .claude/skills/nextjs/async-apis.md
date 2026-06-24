# 非同期 Request API ガイド

Next.js 16 では `cookies()`, `headers()`, `params`, `searchParams` がすべて非同期になりました。

## 変更点

```typescript
// ❌ Before (Next.js 14)
const cookieStore = cookies()
const headersList = headers()

// ✅ After (Next.js 15+)
const cookieStore = await cookies()
const headersList = await headers()
```

## マイグレーション

```bash
npx @next/codemod@canary async-request-api .
```

## cookies()

### 基本的な使い方

```typescript
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()

  // Cookie を取得
  const token = cookieStore.get('auth-token')
  console.log(token?.value)

  // すべての Cookie を取得
  const allCookies = cookieStore.getAll()

  // Cookie の存在確認
  const hasSession = cookieStore.has('session')

  return <div>...</div>
}
```

### Server Action での Cookie 操作

```typescript
'use server'

import { cookies } from 'next/headers'

export async function setCookie(name: string, value: string) {
  const cookieStore = await cookies()

  // Cookie を設定
  cookieStore.set(name, value)

  // オプション付きで設定
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  })
}

export async function deleteCookie(name: string) {
  const cookieStore = await cookies()
  cookieStore.delete(name)
}
```

## headers()

### 基本的な使い方

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()

  // ヘッダーを取得
  const userAgent = headersList.get('user-agent')
  const authorization = headersList.get('authorization')

  // ヘッダーの存在確認
  const hasAuth = headersList.has('authorization')

  // すべてのヘッダーをイテレート
  for (const [key, value] of headersList.entries()) {
    console.log(`${key}: ${value}`)
  }

  return <div>User Agent: {userAgent}</div>
}
```

### API ルートでの使用

```typescript
// app/api/user/route.ts
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const headersList = await headers()

  const session = cookieStore.get('session')
  const authorization = headersList.get('authorization')

  if (!session && !authorization) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ message: 'Authenticated' })
}
```

## params

### 動的ルートパラメータ

```typescript
// app/posts/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: PageProps) {
  // ✅ Next.js 16: params は Promise
  const { id } = await params

  const post = await getPost(id)

  return <article>{post.title}</article>
}
```

### 複数のパラメータ

```typescript
// app/[locale]/posts/[id]/page.tsx
interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function Page({ params }: PageProps) {
  const { locale, id } = await params

  return <div>Locale: {locale}, Post ID: {id}</div>
}
```

## searchParams

### クエリパラメータの取得

```typescript
// app/search/page.tsx
interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  // ✅ Next.js 16: searchParams は Promise
  const { q, page } = await searchParams

  const results = await search(q, Number(page) || 1)

  return <SearchResults results={results} />
}
```

## Layout での使用

```typescript
// app/[locale]/layout.tsx
interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  )
}
```

## generateMetadata での使用

```typescript
// app/posts/[id]/page.tsx
import { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const post = await getPost(id)

  return {
    title: post.title,
    description: post.excerpt,
  }
}
```

## 画像生成での使用

```typescript
// app/posts/[id]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Image({ params }: Props) {
  const { id } = await params
  const post = await getPost(id)

  return new ImageResponse(
    <div>{post.title}</div>,
    { width: 1200, height: 630 }
  )
}
```

## よくあるパターン

### 認証チェック付きページ

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')

  if (!session) {
    redirect('/login')
  }

  return <div>Protected Content</div>
}
```

### ヘッダー転送

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()
  const authorization = headersList.get('authorization')

  const res = await fetch('https://api.example.com/data', {
    headers: {
      authorization: authorization ?? '',
    },
  })

  const data = await res.json()
  return <div>{data}</div>
}
```

## Client Component での注意

Client Component では `cookies()` や `headers()` は使用できません。代わりに：

```typescript
// ❌ Client Component では使用不可
'use client'
import { cookies } from 'next/headers' // Error!

// ✅ Server Component からデータを渡す
// Server Component
export default async function Page() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value

  return <ClientComponent theme={theme} />
}

// Client Component
'use client'
export function ClientComponent({ theme }: { theme?: string }) {
  return <div>Theme: {theme}</div>
}
```

## 型安全性

```typescript
import { cookies, headers } from 'next/headers'

// 型を明示的に指定
type CookieStore = Awaited<ReturnType<typeof cookies>>
type HeadersList = Awaited<ReturnType<typeof headers>>

async function getData() {
  const cookieStore: CookieStore = await cookies()
  const headersList: HeadersList = await headers()

  return {
    session: cookieStore.get('session'),
    userAgent: headersList.get('user-agent'),
  }
}
```
