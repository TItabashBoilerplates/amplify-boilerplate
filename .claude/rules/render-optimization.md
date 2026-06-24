---
paths: frontend/**/*.{ts,tsx,js,jsx}
---

# Render Optimization Policy

**MANDATORY**: コンポーネントの再描画は必要最小限に抑える。FSD のスライス単位でステートを局所化し、状態変更の影響範囲をそのスライス内に閉じ込める。モノレポの `packages/` とアプリ固有の FSD レイヤーの責務分担を正しく行い、アプリを跨ぐ共通ロジックは `packages/` に集約する。

## 基本原則: モノレポ × FSD のステート所有権階層

このプロジェクトでは**モノレポの packages 層**と**アプリ固有の FSD 層**が共存する。ステート所有権はこの二層構造に沿って配置する。

```
packages/                        ← クロスアプリ共有（Web/Mobile 両方で使用）
├── auth/                        → 認証ステート（Zustand ストア）
├── app/                         → 共有 Entity・Feature（クエリ、ミューテーション）
│   ├── entities/                → 共有ドメインデータ（クエリキー定数、クエリフック）
│   └── features/                → 共有ユーザーアクション（ミューテーション）
├── query/                       → TanStack Query クライアント設定
├── client-supabase/             → Supabase クライアント（ステートレス）
├── types/                       → 型定義（ステートレス）
└── ui/                          → UI コンポーネント（ステートレス）

apps/web/src/                    ← Web 固有の FSD レイヤー
├── app/                         → グローバルプロバイダー（Context 設定のみ）
├── views/                       → ページ構成（ステートを持たない）
├── widgets/                     → Feature/Entity の組み合わせ（レイアウト用 UI ステートのみ）
├── features/                    → Web 固有のユーザーアクション
├── entities/                    → Web 固有のドメインデータ
└── shared/                      → Web 固有の共有インフラ
```

### 判断基準: packages/ vs apps/ のどちらに配置するか

| 条件 | 配置先 | 例 |
|------|--------|-----|
| Web/Mobile 両方で使うエンティティ・機能 | `packages/app/` | ユーザー、認証、共通ドメインモデル |
| Web/Mobile 両方で使うストア | `packages/auth/` 等の専用パッケージ | 認証ステート |
| Web/Mobile 両方で使うクエリキー・フック | `packages/app/entities/` | 共通クエリキー定数 |
| 特定アプリのみの機能 | `apps/web/src/features/` 等 | Web 固有のダッシュボード機能 |
| 特定アプリのみの UI 構成 | `apps/web/src/widgets/` 等 | Web 固有のヘッダー、サイドバー |

**核心**: ステートの所有権が「packages/ → apps/ FSD レイヤー」の階層に沿って正しく配置されていれば、再描画は自然と最小範囲に収まる。

## ルール 1: Entity と Feature のステート所有権を分離する

### packages/ の共有 Entity: クロスアプリのドメインデータを所有

Web/Mobile 両方で使うドメインデータは `packages/app/entities/` に配置する。
クエリキー定数とクエリフックをここで定義し、各アプリの Feature から利用する。

```typescript
// packages/app/entities/item/queries.ts
// クロスアプリ共有のクエリキー定数
export const itemKeys = {
  all: ['items'] as const,
  detail: (id: string) => ['items', id] as const,
  favorite: (id: string) => ['items', id, 'favorite'] as const,
}

// packages/app/entities/item/hooks.ts
// クロスアプリ共有のクエリフック
export function useItem(itemId: string) {
  return useQuery({
    queryKey: itemKeys.detail(itemId),
    queryFn: () => fetchItem(itemId),
  })
}

// packages/app/entities/item/index.ts - Public API
export { itemKeys } from './queries'
export { useItem } from './hooks'
export type { Item } from './types'
```

### アプリ固有の Entity: そのアプリだけのドメインデータ

Web だけで使うドメインデータは `apps/web/src/entities/` に配置する。
packages の共有 Entity をインポートして拡張・利用できる。

```typescript
// apps/web/src/entities/item/model/hooks.ts
// Web 固有のクエリフック（packages の共有キーを使用）
import { itemKeys } from '@workspace/app'

export function useItemWithWebMetadata(itemId: string) {
  return useQuery({
    queryKey: [...itemKeys.detail(itemId), 'web-metadata'],
    queryFn: () => fetchItemWithWebMetadata(itemId),
  })
}
```

### Feature: ユーザーアクションの状態を所有

ミューテーション（書き込み操作）は Feature に配置する。共有か固有かで配置先が変わる。

```typescript
// packages/app/features/favorite/hooks.ts（Web/Mobile 共通のお気に入り機能）
import { itemKeys } from '../entities/item'  // packages 内の下位レイヤー

export function useToggleFavorite(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => toggleFavorite(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.favorite(itemId),  // ピンポイント invalidate
      })
    },
  })
}

// apps/web/src/features/favorite/model/hooks.ts（Web 固有の拡張がある場合）
import { itemKeys } from '@workspace/app'

export function useToggleFavoriteWithToast(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => toggleFavorite(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.favorite(itemId) })
      toast.success('お気に入りに追加しました')  // Web 固有の UI フィードバック
    },
  })
}
```

### 禁止パターン

```typescript
// ❌ Bad: アプリ固有の entities/ に共通ドメインロジックを配置
// apps/web/src/entities/user/model/store.ts
export const useUserStore = create(...)  // Web/Mobile 共通なのに Web に配置

// ✅ Good: packages/auth/ に配置し両アプリから利用
// packages/auth/store/authStore.ts
export const useAuthStore = create(...)

// ❌ Bad: Feature がドメインデータのクエリを所有（Entity の責務）
// features/favorite/model/hooks.ts
export function useFavoriteStatus(itemId: string) {
  return useQuery({ queryKey: ['items', itemId], queryFn: () => fetchItem(itemId) })
}

// ❌ Bad: Entity がミューテーションを所有（Feature の責務）
// entities/item/model/hooks.ts
export function useToggleFavorite(itemId: string) {
  return useMutation({ ... })
}

// ❌ Bad: Web/Mobile 両方で使うロジックを apps/ に重複実装
// apps/web/src/features/favorite/... と apps/mobile/src/features/favorite/... に同じ実装
```

## ルール 2: packages/ の Zustand ストアはセレクター必須

`packages/auth/` 等のクロスアプリ共有ストアは、複数アプリから購読される。
セレクターを使用しなければ、無関係な状態変更が全アプリの全コンポーネントに波及する。

```typescript
// packages/auth/hooks/useAuth.ts
// ✅ Good: セレクター付きカスタムフックをエクスポート
export function useAuthUser() {
  return useAuthStore((state) => state.user)  // user だけを購読
}

export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated)  // boolean だけを購読
}

// packages/auth/index.ts - Public API
// ✅ Good: セレクター付きフックをエクスポート
export { useAuthUser, useIsAuthenticated } from './hooks/useAuth'
export { useAuthStore } from './store/authStore'  // 直接使用は非推奨（上記フック推奨）
```

```typescript
// apps/web/src/features/user-menu/ui/UserMenu.tsx
// ✅ Good: packages の セレクター付きフックを使用
import { useAuthUser } from '@workspace/auth'
const user = useAuthUser()  // user 変更時のみ再描画

// ❌ Bad: ストア全体を購読
import { useAuthStore } from '@workspace/auth'
const store = useAuthStore()  // 任意の認証状態変更で再描画
const user = store.user
```

**packages/ のストアは、セレクター付きカスタムフックを Public API として優先エクスポートする。ストアの直接利用はアプリ側で特殊なケースにのみ許可。**

## ルール 3: Widget・View はフィーチャーを「組み合わせる」だけ

Widget と View は Feature や Entity を**組み合わせる（コンポジション）**レイヤーであり、ビジネスステートやサーバーステートを**所有しない**。packages/ からも apps/ からもインポートするが、ステートは持たない。

```typescript
// ✅ Good: Widget は packages と apps の Feature/Entity を組み合わせるだけ
// apps/web/src/widgets/item-card/ui/ItemCard.tsx
import { ItemDetails } from '@workspace/app'             // packages の共有 Entity UI
import { FavoriteButton } from '@/features/favorite'     // Web 固有の Feature UI
import { ShareButton } from '@/features/share'           // Web 固有の Feature UI

export function ItemCard({ itemId }: Props) {
  return (
    <Card>
      <ItemDetails itemId={itemId} />       {/* 独立して再描画 */}
      <FavoriteButton itemId={itemId} />    {/* 独立して再描画 */}
      <ShareButton itemId={itemId} />       {/* 独立して再描画 */}
    </Card>
  )
}
```

```typescript
// ❌ Bad: Widget がフィーチャーの状態を管理
export function ItemCard({ itemId }: Props) {
  const { data: item } = useQuery({ queryKey: ['items', itemId] })  // Widget がクエリを所有
  const [isFavorite, setIsFavorite] = useState(item?.isFavorite)    // Widget がステートを持つ
  return (
    <Card>
      <ItemDetails item={item} />
      <button onClick={() => setIsFavorite(!isFavorite)}>♥</button>
      {/* ↑ お気に入りを押すとカード全体（ItemDetails含む）が再描画 */}
    </Card>
  )
}
```

### Widget・View が持ってよいステート

| 許可 | 例 |
|------|-----|
| レイアウト制御 | サイドバーの開閉、タブの選択 |
| UI のみのローカル状態 | ドロップダウンの開閉、モーダルの表示 |

## ルール 4: 同一レイヤー間のステート共有禁止

FSD の核心ルール「**同一レイヤーのスライス間は直接インポートできない**」は、再描画の分離に直結する。これは packages/ 内の同一レイヤーでも同様。

```typescript
// ❌ Bad: Feature 間の直接インポート（FSD 違反 + 再描画が連鎖）
// apps/web/src/features/share/model/hooks.ts
import { useFavoriteCount } from '@/features/favorite'  // 同一レイヤー間インポート禁止

// ❌ Bad: packages 内でも同一レイヤー間のインポートは禁止
// packages/app/features/share/hooks.ts
import { useToggleFavorite } from '../favorite/hooks'  // Feature 間の直接参照

// ✅ Good: 下位レイヤー（Entity）を介して間接的にデータを共有
// packages/app/entities/item/ が共有データを所有し、各 Feature が独立して購読
// features/favorite/ → entities/item のキーを invalidate
// features/share/    → entities/item のキーを購読（select で必要なデータだけ）
```

**再描画の文脈での意味**: 同一レイヤーのスライスが互いのステートを参照しなければ、あるスライスの状態変更が別のスライスの再描画を引き起こすことはない。

## ルール 5: TanStack Query のキー設計と invalidation

### クエリキー定数は Entity が所有し packages/ でエクスポート

```typescript
// packages/app/entities/post/queries.ts - Entity がキー構造を定義
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  detail: (id: string) => [...postKeys.all, id] as const,
  comments: (id: string) => [...postKeys.all, id, 'comments'] as const,
  favorite: (id: string) => [...postKeys.all, id, 'favorite'] as const,
}

// packages/app/index.ts - Public API でエクスポート
export { postKeys } from './entities/post/queries'
```

### ピンポイント invalidation（必須）

```typescript
// ✅ Good: Feature が packages の Entity キー定数を使って最小範囲を invalidate
import { postKeys } from '@workspace/app'
queryClient.invalidateQueries({ queryKey: postKeys.favorite(postId) })

// ❌ Bad: 広範囲の invalidation → 全投稿コンポーネントが再描画
queryClient.invalidateQueries({ queryKey: ['posts'] })

// ❌ Bad: キー定数を使わずハードコード → packages と apps で不整合リスク
queryClient.invalidateQueries({ queryKey: ['posts', postId, 'favorite'] })
```

### select による購読の限定

```typescript
// ✅ Good: 必要なデータだけを購読 → その値が変わった時だけ再描画
import { postKeys } from '@workspace/app'

const { data: isFavorite } = useQuery({
  queryKey: postKeys.detail(postId),
  queryFn: () => fetchPost(postId),
  select: (data) => data.isFavorited,  // boolean だけを購読
})

// ❌ Bad: オブジェクト全体を購読 → 任意のフィールド変更で再描画
const { data: post } = useQuery({
  queryKey: postKeys.detail(postId),
  queryFn: () => fetchPost(postId),
})
const isFavorite = post?.isFavorited
```

## ルール 6: Context の分割

```typescript
// ✅ Good: ドメインと更新頻度で Context を分割（packages/ のプロバイダーも同様）
// packages/query/ の QueryProvider と packages/auth/ の AuthProvider は分離済み
<QueryProvider>
  <AuthProvider>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </AuthProvider>
</QueryProvider>

// ✅ Good: 状態とディスパッチを分離
const StateContext = createContext<State>(initialState)
const DispatchContext = createContext<Dispatch>(() => {})

// ❌ Bad: 単一の巨大 Context（packages/ であっても禁止）
<AppContext.Provider value={{ auth, theme, notifications, settings, ... }}>
  {children}
</AppContext.Provider>
```

**頻繁に更新される状態には Context ではなく Zustand または TanStack Query を使用する。**

## ルール 7: React Compiler を信頼する（React 19+）

React Compiler が自動でメモ化するため、手動 `useMemo` / `useCallback` / `React.memo` は原則不要。

**ただし**: React Compiler は以下のアーキテクチャ問題を解決しない：
- ステートの配置が高すぎる問題（packages/ vs apps/ の配置ミスを含む）
- 広範囲な Context による再描画
- TanStack Query の invalidation スコープが広すぎる問題
- Zustand のセレクター未使用（packages/ のストアも含む）
- apps/ 間でのロジック重複による非効率

**これらはアーキテクチャ（モノレポ構成 + FSD のレイヤー設計）で解決する問題であり、メモ化では解決できない。**

## モノレポ × FSD × 再描画 総合例

```
frontend/
├── packages/app/
│   ├── entities/item/
│   │   ├── queries.ts         # クエリキー定数（Web/Mobile 共有）
│   │   ├── hooks.ts           # useItem クエリフック（Web/Mobile 共有）
│   │   ├── types.ts
│   │   └── index.ts           # Public API
│   └── features/favorite/
│       ├── hooks.ts           # useToggleFavorite ミューテーション（Web/Mobile 共有）
│       └── index.ts           # Public API
│
├── packages/auth/
│   ├── store/authStore.ts     # 認証ストア（Web/Mobile 共有）
│   ├── hooks/useAuth.ts       # セレクター付きフック（Web/Mobile 共有）
│   └── index.ts               # Public API
│
└── apps/web/src/
    ├── entities/item/
    │   ├── model/hooks.ts     # Web 固有の拡張クエリ（必要な場合のみ）
    │   ├── ui/ItemDetails.tsx  # useItem(itemId) で独立して再描画
    │   └── index.ts
    │
    ├── features/favorite/
    │   ├── ui/FavoriteButton.tsx  # useToggleFavorite で独立して再描画
    │   └── index.ts              # FavoriteButton だけをエクスポート
    │
    ├── features/share/
    │   ├── ui/ShareButton.tsx    # 独立して再描画（favorite と無関係）
    │   └── index.ts
    │
    └── widgets/item-card/
        ├── ui/ItemCard.tsx       # 3つを組み合わせるだけ（ステートなし）
        └── index.ts
```

**結果**: お気に入りボタンを押したとき：
1. `packages/app/features/favorite/` のミューテーションが実行
2. `packages/app/entities/item/` の `favorite` キーだけが invalidate
3. `FavoriteButton` だけが再描画
4. `ItemDetails`、`ShareButton`、`ItemCard` は再描画されない
5. Mobile アプリでも同じ `packages/` のロジックで同じ再描画最適化が効く

## チェックリスト（実装時に確認）

| # | 確認事項 |
|---|---------|
| 1 | **packages/ vs apps/**: Web/Mobile 共通のロジックは packages/ に配置しているか？apps/ に重複実装していないか？ |
| 2 | **Entity vs Feature**: ドメインデータのクエリは Entity（packages/ or apps/）に、ミューテーションは Feature にあるか？ |
| 3 | **クエリキー定数**: packages/ の Entity がキー定数を定義し、Feature はそれを使って invalidate しているか？ハードコードしていないか？ |
| 4 | **packages/ のストア**: セレクター付きカスタムフックを Public API として提供しているか？ストア直接利用を強制していないか？ |
| 5 | **Widget/View**: ビジネスステートやサーバーステートを持っていないか？Feature を組み合わせているだけか？ |
| 6 | **同一レイヤー間**: 同じレイヤーの別スライスのステートを直接インポートしていないか？（packages/ 内も含む） |
| 7 | **TanStack Query**: Entity のクエリキー定数を使い、ピンポイントで invalidate しているか？ |
| 8 | **Zustand**: セレクター付きで使用しているか？引数なしの `useStore()` を使っていないか？ |
| 9 | **再描画の影響範囲**: 状態変更時に、そのスライスの UI だけが再描画されるか？兄弟スライスに影響しないか？ |

## 強制事項

このポリシーは **NON-NEGOTIABLE**。モノレポの packages/ と FSD のレイヤー階層に沿ったステート所有権の分離は、再描画の最小化だけでなく、コードの保守性・テスタビリティ・スライス間の独立性・クロスプラットフォームの一貫性に直結する。ステートの配置を誤ると、FSD のスライス分割が形骸化し、モノレポの共通化の意味もなくなる。
