---
name: nextjs
description: Next.js 16 App Router ガイダンス。Proxy（旧Middleware）、非同期API（cookies/headers）、use cache ディレクティブ、Server/Client Components、Turbopack についての質問に使用。最新のベストプラクティス、破壊的変更への対応支援を提供。
---

# Next.js 16 スキル

このプロジェクトは Next.js 16 (App Router) を使用しています。

## Next.js 16 の主な変更点

### 破壊的変更

| 変更点 | 詳細 |
|--------|------|
| **Proxy（旧 Middleware）** | `middleware.ts` → `proxy.ts`、関数名 `middleware()` → `proxy()` |
| **非同期 Request API** | `cookies()`, `headers()`, `params`, `searchParams` はすべて `await` 必須 |
| **Turbopack デフォルト化** | `next dev` と `next build` で Turbopack がデフォルトに |
| **Node.js 最小バージョン** | 20.9.0 (LTS) |
| **TypeScript 最小バージョン** | 5.1.0 |
| **ブラウザサポート** | Chrome/Edge/Firefox 111+, Safari 16.4+ |

### 新機能

| 機能 | 説明 |
|------|------|
| **`use cache`** | コンポーネント/関数レベルのキャッシュ |
| **`use cache: remote`** | リモートキャッシュ（ランタイム共有） |
| **`use cache: private`** | ユーザー固有のプライベートキャッシュ |
| **`cacheLife()` / `cacheTag()`** | キャッシュの有効期限と再検証タグ |
| **Turbopack FS キャッシュ** | ビルド高速化のためのファイルシステムキャッシュ |

## クイックリファレンス

### Proxy（旧 Middleware）

```typescript
// proxy.ts（Next.js 16）
import { NextResponse, NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

### 非同期 Request API

```typescript
// Server Component
import { cookies, headers } from 'next/headers'

export default async function Page() {
  // ✅ Next.js 16: await 必須
  const cookieStore = await cookies()
  const headersList = await headers()

  const token = cookieStore.get('token')
  const userAgent = headersList.get('user-agent')

  return <div>...</div>
}
```

### use cache ディレクティブ

```typescript
// コンポーネントレベルのキャッシュ
export default async function Page() {
  'use cache'

  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}

// 関数レベルのキャッシュ
async function getProducts() {
  'use cache'
  return db.query('SELECT * FROM products')
}
```

### Server / Client Components

```typescript
// Server Component（デフォルト）
export default async function Page() {
  const data = await fetchData()
  return <ClientComponent initialData={data} />
}

// Client Component
'use client'
import { useState } from 'react'

export function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData)
  return <button onClick={() => setData(...)}>Update</button>
}
```

## マイグレーションコマンド

```bash
# Next.js 16 へのアップグレード
npx @next/codemod@canary upgrade

# Middleware → Proxy マイグレーション
npx @next/codemod@canary middleware-to-proxy .

# 非同期 API マイグレーション
npx @next/codemod@canary async-request-api .
```

## 詳細ガイド

| トピック | ファイル | 内容 |
|---------|---------|------|
| Proxy | [proxy.md](proxy.md) | 旧 Middleware からの移行、設定例、認証パターン |
| 非同期 API | [async-apis.md](async-apis.md) | cookies(), headers(), params, searchParams の使い方 |
| キャッシュ | [caching.md](caching.md) | use cache ディレクティブ、cacheLife, cacheTag |
| コンポーネント | [components.md](components.md) | Server/Client Components のベストプラクティス |

## このプロジェクトでの実装

### ディレクトリ構成

```
frontend/apps/web/
├── app/                    # Next.js App Router
│   └── [locale]/           # i18n ルート
├── proxy.ts                # Proxy（旧 Middleware）
└── src/                    # FSD レイヤー
    ├── views/              # ページコンポーネント
    ├── widgets/            # 大きな UI ブロック
    ├── features/           # 機能単位
    ├── entities/           # ビジネスエンティティ
    └── shared/             # 共有コード
```

### 使用パッケージ

| パッケージ | 用途 |
|-----------|------|
| `@workspace/client-supabase` | Supabase クライアント |
| `next-intl` | 多言語対応 |
| `@tanstack/react-query` | サーバー状態管理 |

## 参考リンク

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Proxy (formerly Middleware)](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
