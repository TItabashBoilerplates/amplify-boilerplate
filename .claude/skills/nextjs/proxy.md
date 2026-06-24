# Proxy（旧 Middleware）ガイド

Next.js 16 で `middleware` は `proxy` にリネームされました。

**公式ドキュメント**: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

## 変更点

| Next.js 15 以前 | Next.js 16 |
|----------------|------------|
| `middleware.ts` | `proxy.ts` |
| `export function middleware()` | `export function proxy()` |

## マイグレーション

### 自動マイグレーション

```bash
npx @next/codemod@canary middleware-to-proxy .
```

### 手動マイグレーション

```typescript
// ❌ Before (Next.js 15)
// middleware.ts
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// ✅ After (Next.js 16)
// proxy.ts
export function proxy(request: NextRequest) {
  return NextResponse.next()
}
```

## 基本構造

```typescript
// proxy.ts
import { NextResponse, NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // リクエスト処理
  return NextResponse.next()
}

// マッチするパスを指定
export const config = {
  matcher: [
    // 以下を除くすべてのパス:
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /_vercel (Vercel internals)
    // - 静的ファイル (.js, .css, .png など)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
```

## 一般的なパターン

### 1. リダイレクト

```typescript
import { NextResponse, NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 古いパスから新しいパスへリダイレクト
  if (pathname.startsWith('/old-path')) {
    return NextResponse.redirect(
      new URL(pathname.replace('/old-path', '/new-path'), request.url)
    )
  }

  return NextResponse.next()
}
```

### 2. 認証チェック

```typescript
import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'

const protectedRoutes = ['/dashboard', '/settings', '/profile']
const publicRoutes = ['/login', '/signup', '/']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.includes(path)

  // セッション Cookie を確認
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  // 未認証で保護されたルートにアクセス
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  // 認証済みでログインページにアクセス
  if (isPublicRoute && session && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl))
  }

  return NextResponse.next()
}
```

### 3. CORS 設定

```typescript
import { NextResponse, NextRequest } from 'next/server'

const allowedOrigins = ['https://example.com', 'https://app.example.com']

const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') ?? ''
  const isAllowedOrigin = allowedOrigins.includes(origin)

  // Preflight リクエスト
  if (request.method === 'OPTIONS') {
    const preflightHeaders = {
      ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      ...corsOptions,
    }
    return NextResponse.json({}, { headers: preflightHeaders })
  }

  // 通常のリクエスト
  const response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }

  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: '/api/:path*',
}
```

### 4. ユーザーエージェント検出

```typescript
import { NextResponse, NextRequest, userAgent } from 'next/server'

export function proxy(request: NextRequest) {
  const url = request.nextUrl
  const { device } = userAgent(request)

  // device.type: 'mobile', 'tablet', 'console', 'smarttv', 'wearable', 'embedded', undefined (desktop)
  const viewport = device.type || 'desktop'

  url.searchParams.set('viewport', viewport)
  return NextResponse.rewrite(url)
}
```

## このプロジェクトでの実装

```typescript
// frontend/apps/web/proxy.ts
import { updateSession } from '@workspace/client-supabase/middleware'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './src/shared/config/i18n'

const handleI18nRouting = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  // Step 1: next-intl のルーティング処理
  const response = handleI18nRouting(request)

  // Step 2: Supabase セッション更新
  return await updateSession(request, response)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

> **注意**: このプロジェクトではファイル名は `proxy.ts` ですが、next-intl との互換性のため関数名は `middleware` のままです。Next.js 16 では両方の名前が動作しますが、将来的には `proxy` に統一することを推奨します。

## マッチャーパターン

```typescript
export const config = {
  matcher: [
    // 単一パス
    '/about',

    // ワイルドカード
    '/dashboard/:path*',

    // 正規表現
    '/((?!api|_next/static|_next/image|favicon.ico).*)',

    // 複数パターン
    ['/dashboard/:path*', '/account/:path*'],
  ],
}
```

## 条件付きマッチング

```typescript
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      // locale は missing のときのみマッチ
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

## ベストプラクティス

1. **軽量に保つ**: Proxy はすべてのリクエストで実行されるため、処理を最小限に
2. **非同期 API を使用**: `cookies()`, `headers()` は `await` が必要
3. **レスポンスを常に返す**: `NextResponse.next()` または `NextResponse.redirect()` を返す
4. **matcher を適切に設定**: 不要なパスを除外してパフォーマンス向上
