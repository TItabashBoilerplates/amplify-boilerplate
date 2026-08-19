---
description: "Render optimization - keep state ownership inside its FSD slice"
alwaysApply: true
globs: ["frontend/**/*.tsx", "frontend/**/*.ts"]
---
# Render Optimization Policy

**MANDATORY**: 再描画は必要最小限に。FSD のスライス単位でステートを局所化し、
状態変更の影響をそのスライス内に閉じ込める。

正本: `/.claude/rules/render-optimization.md`

## ステート所有権

| 対象 | 置き場所 |
|---|---|
| Web / Mobile 共通のドメインデータ・クエリキー | `packages/app/entities/` |
| Web / Mobile 共通のミューテーション | `packages/app/features/` |
| 共有ストア（認証等） | `packages/auth/` 等の専用パッケージ |
| アプリ固有 | 各 `apps/*/src` の FSD レイヤー |

- **Entity** がドメインデータのクエリとクエリキー定数を所有する
- **Feature** がミューテーションを所有する
- **Widget / View はステートを持たない**（Feature / Entity を組み合わせるだけ。
  レイアウト用の UI ステートのみ可）

## TanStack Query

```typescript
// ✅ Entity のキー定数でピンポイントに invalidate
queryClient.invalidateQueries({ queryKey: postKeys.favorite(postId) })

// ❌ 広範囲 → 全投稿コンポーネントが再描画
queryClient.invalidateQueries({ queryKey: ['posts'] })

// ✅ select で必要な値だけ購読
useQuery({ queryKey: postKeys.detail(id), queryFn, select: (d) => d.isFavorited })
```

## Zustand はセレクター必須

```typescript
const user = useAuthUser()        // ✅ セレクター付きフック
const store = useAuthStore()      // ❌ 任意の状態変更で再描画
```

## 同一レイヤー間のステート共有禁止

Feature 同士を直接 import しない（下位レイヤーの Entity を介する）。
FSD の依存方向を守れば、あるスライスの状態変更が別のスライスを再描画することはない。

**React Compiler はこれらのアーキテクチャ問題を解決しない**（メモ化では直らない）。
