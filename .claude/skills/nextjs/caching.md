# キャッシュガイド（use cache）

Next.js 16 では `use cache` ディレクティブでコンポーネントや関数レベルのキャッシュが可能です。

## use cache の種類

| ディレクティブ | 説明 | 用途 |
|--------------|------|------|
| `'use cache'` | デフォルトキャッシュ（ビルド時/静的） | 全ユーザー共通の静的データ |
| `'use cache: remote'` | リモートキャッシュ（ランタイム共有） | 全ユーザー共通の動的データ |
| `'use cache: private'` | プライベートキャッシュ | ユーザー固有のデータ |

## 基本的な使い方

### ファイルレベル

```typescript
// ファイル全体をキャッシュ
'use cache'

export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}

export async function getStaticData() {
  const data = await db.query('SELECT * FROM products')
  return data
}
```

### コンポーネントレベル

```typescript
export default async function Page() {
  return (
    <div>
      <Header />
      <CachedContent /> {/* キャッシュされる */}
      <DynamicContent /> {/* キャッシュされない */}
    </div>
  )
}

async function CachedContent() {
  'use cache'

  const products = await db.query('SELECT * FROM products')
  return <ProductList products={products} />
}

async function DynamicContent() {
  const user = await getCurrentUser()
  return <UserProfile user={user} />
}
```

### 関数レベル

```typescript
async function getProducts() {
  'use cache'
  return db.query('SELECT * FROM products')
}

async function getCategories() {
  'use cache'
  return db.query('SELECT * FROM categories')
}

export default async function Page() {
  // 両方の関数がキャッシュされる
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ])

  return <Shop products={products} categories={categories} />
}
```

## cacheLife - キャッシュ有効期限

```typescript
import { cacheLife } from 'next/cache'

async function getAnalytics() {
  'use cache'
  cacheLife({ expire: 300 }) // 5分間キャッシュ

  return fetchAnalyticsData()
}

async function getNews() {
  'use cache'
  cacheLife({
    stale: 60,      // 60秒後に古いとみなす
    revalidate: 300, // 300秒後に再検証
    expire: 3600,    // 1時間後に完全に期限切れ
  })

  return fetchLatestNews()
}
```

### プリセット

```typescript
import { cacheLife } from 'next/cache'

// プリセットを使用
cacheLife('seconds')  // { stale: 0, revalidate: 1, expire: 60 }
cacheLife('minutes')  // { stale: 60, revalidate: 60, expire: 3600 }
cacheLife('hours')    // { stale: 300, revalidate: 300, expire: 86400 }
cacheLife('days')     // { stale: 3600, revalidate: 3600, expire: 604800 }
cacheLife('weeks')    // { stale: 86400, revalidate: 86400, expire: 2592000 }
cacheLife('max')      // { stale: 86400, revalidate: 86400, expire: 31536000 }
```

## cacheTag - キャッシュタグ

```typescript
import { cacheTag, revalidateTag } from 'next/cache'

async function getProduct(id: string) {
  'use cache'
  cacheTag(`product-${id}`)

  return db.products.find({ where: { id } })
}

// Server Action で再検証
'use server'

export async function updateProduct(id: string, data: ProductData) {
  await db.products.update({ where: { id }, data })

  // タグを使って関連するキャッシュを再検証
  revalidateTag(`product-${id}`)
}
```

## use cache: remote

ランタイムで全ユーザー間で共有されるキャッシュです。

```typescript
import { connection } from 'next/server'
import { cacheLife } from 'next/cache'

export default async function Page() {
  // 動的コンテキストを作成
  await connection()

  // キャッシュされないデータ
  const stats = await getRealtimeStats()

  // リモートキャッシュされるデータ
  const analytics = await getAnalytics()

  return (
    <div>
      <RealtimeStats data={stats} />
      <Analytics data={analytics} />
    </div>
  )
}

async function getAnalytics() {
  'use cache: remote'
  cacheLife({ expire: 300 }) // 5分

  // この高コストな操作は全リクエストで共有される
  return processAnalyticsData()
}
```

## use cache: private

ユーザー固有のデータをキャッシュします。

```typescript
import { cookies } from 'next/headers'
import { cacheLife } from 'next/cache'

async function getRecommendations(productId: string) {
  'use cache: private'
  cacheLife({ expire: 60 }) // 1分

  const sessionId = (await cookies()).get('session-id')?.value

  // ユーザーごとにキャッシュされる
  return db.recommendations.findMany({
    where: { productId, sessionId },
  })
}
```

## 混合キャッシュ戦略

```typescript
import { Suspense } from 'react'
import { connection } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'

// 静的データ（ビルド時にキャッシュ）
async function getProduct(id: string) {
  'use cache'
  cacheTag(`product-${id}`)

  return db.products.find({ where: { id } })
}

// 共有動的データ（リモートキャッシュ）
async function getProductPrice(id: string) {
  'use cache: remote'
  cacheLife({ expire: 300 })

  return db.products.getPrice({ where: { id } })
}

// ユーザー固有データ（プライベートキャッシュ）
async function getRecommendations(productId: string) {
  'use cache: private'
  cacheLife({ expire: 60 })

  const sessionId = (await cookies()).get('session-id')?.value
  return db.recommendations.findMany({ where: { productId, sessionId } })
}

export default async function ProductPage({ params }) {
  const { id } = await params
  const product = await getProduct(id)

  return (
    <div>
      <ProductDetails product={product} />

      <Suspense fallback={<PriceSkeleton />}>
        <ProductPrice productId={id} />
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations productId={id} />
      </Suspense>
    </div>
  )
}
```

## 従来の設定からの移行

### force-static → use cache

```typescript
// ❌ Before
export const dynamic = 'force-static'

export default async function Page() {
  const data = await fetch('...')
  return <div>{data}</div>
}

// ✅ After
export default async function Page() {
  'use cache'

  const data = await fetch('...')
  return <div>{data}</div>
}
```

### fetchCache → use cache

```typescript
// ❌ Before
export const fetchCache = 'force-cache'

export default async function Page() {
  const data = await fetch('...')
  return <div>{data}</div>
}

// ✅ After
export default async function Page() {
  'use cache'
  // すべての fetch が自動的にキャッシュされる

  const data = await fetch('...')
  return <div>{data}</div>
}
```

## 注意事項

### キャッシュ内で使用できないもの

```typescript
// ❌ use cache 内で使用不可
export default async function Page() {
  'use cache'

  // これらはエラーになる
  const cookieStore = await cookies()  // ❌
  const headersList = await headers()  // ❌

  return <div>...</div>
}

// ✅ 動的データはキャッシュ外で取得
export default async function Page() {
  // 動的データ（キャッシュ外）
  const cookieStore = await cookies()
  const session = cookieStore.get('session')

  // 静的データ（キャッシュ内）
  const products = await getCachedProducts()

  return <div>...</div>
}

async function getCachedProducts() {
  'use cache'
  return db.products.findMany()
}
```

### シリアライズ可能なデータのみ

キャッシュされるデータは JSON シリアライズ可能である必要があります。

```typescript
// ❌ 関数はキャッシュ不可
async function getData() {
  'use cache'
  return {
    data: 'value',
    callback: () => {} // Error: 関数はシリアライズ不可
  }
}

// ✅ プレーンなデータのみ
async function getData() {
  'use cache'
  return {
    data: 'value',
    timestamp: Date.now()
  }
}
```
