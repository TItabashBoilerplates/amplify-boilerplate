---
paths: frontend/apps/web/app/**/*.{ts,tsx}
---

# Page Navigation Policy

**MANDATORY**: ページ遷移は即座に反応させ、データ取得中はストリーミングで UI を描画する。

## 基本原則

Next.js App Router の Server Component はデフォルトでは RSC ペイロードがサーバーで完成するまでブラウザ上の遷移を止める。これは「リンクを押しても何も起きない」UX を生むため、**本プロジェクトでは `loading.tsx` + `<Suspense>` によるストリーミングを必須**とする。

## ルール 1: ルートセグメントには `loading.tsx` を置く

最低限 `app/[locale]/loading.tsx`（locale 配下共通フォールバック）を置くこと。個別セグメントで**期待される骨格が大きく異なる**場合は、そのセグメント固有の `loading.tsx` を追加する（例: ダッシュボードはカードグリッドのスケルトン）。

| 配置 | 役割 |
|------|------|
| `app/[locale]/loading.tsx` | 全ルート共通のフォールバック（Header + 汎用スケルトン） |
| `app/[locale]/<segment>/loading.tsx` | そのセグメントの UI 形状に合わせたスケルトン |

`loading.tsx` は Server Component（`'use client'` 不要）。`getTranslations('Loading')` で i18n 対応する。

## ルール 2: 遅いデータ取得は `<Suspense>` で分離する

Server Component 内で「200ms 以上かかる可能性がある」データ取得（外部 API、重い DB クエリ、バックエンド呼び出し）は、専用の async Server Component に切り出して `<Suspense>` で包む。

```tsx
// ❌ Bad: すべて直列 await → 一番遅いものに遷移全体が引きずられる
export default async function Page() {
  const user = await getUser()
  const backend = await fetchBackend()
  return <View user={user} backend={backend} />
}

// ✅ Good: 認証だけ await し、バックエンドは Suspense でストリーム
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <View
      user={user}
      backendSlot={
        <Suspense fallback={<BackendSkeleton />}>
          <BackendInfo />
        </Suspense>
      }
    />
  )
}
```

### 例外: 認証・認可チェックはブロックして良い

認証チェック（`runWithAmplifyServerContext` + `getCurrentUser`）や認可の決定は shell 描画前に `await` する。Suspense 内で行うと未認証 UI が一瞬漏れるリスクがあるため。

## ルール 3: View コンポーネントは slot で受け取る

ストリーミング対象のサブツリーは、View 層（`views/*/ui/`）では `ReactNode` 型の slot prop として受け取る。ページコンポーネント側で `<Suspense>` を構築して渡す。

```tsx
// views/dashboard/ui/DashboardPage.tsx
interface Props {
  userEmail: string
  backendSlot: ReactNode
}
export default function DashboardPage({ userEmail, backendSlot }: Props) {
  return <main>{userEmail} {backendSlot}</main>
}

// app/[locale]/dashboard/page.tsx
<DashboardPage
  userEmail={user.email}
  backendSlot={
    <Suspense fallback={<BackendSkeleton />}>
      <BackendInfo />
    </Suspense>
  }
/>
```

View は Client/Server どちらでも組み立てられるよう**自らデータを取得しない**（FSD × 再描画ポリシー `.claude/rules/render-optimization.md` と整合）。

## ルール 4: `error.tsx` を必ず置く

Suspense を導入する以上、境界内のエラーを回復する導線が必須。`.claude/rules/error-handling.md` の方針に従い以下を設置:

- `app/[locale]/error.tsx` — locale 配下の Server Component エラー捕捉（必須）
- `app/global-error.tsx` — ルートレイアウトごとクラッシュしたときの最終フォールバック（必須、html/body を含める）

両方とも `'use client'` 必須、`useEffect` で `console.error(error)`、ユーザー向けには `reset()` ボタンを用意する。

## ルール 5: Link プリフェッチを活かす

- 遷移リンクは `next/link` もしくは `@/shared/lib/i18n` の `Link`（next-intl ラッパー）を使用
- 素の `<a href>` は遷移に使わない（プリフェッチが効かず SPA 遷移にならない）
- プリフェッチはデフォルト有効。明示的に無効化しない

## ルール 6: スケルトンは `packages/ui/components/skeleton` を使う

独自の `animate-pulse` div を散らかさず、共有の `Skeleton` コンポーネントを使用する。スケルトンの寸法は実コンテンツの寸法に合わせる（レイアウトシフトを抑制）。

## チェックリスト

新規ページ / セグメントを追加するとき:

| # | 確認 |
|---|------|
| 1 | そのセグメントに対応する `loading.tsx` があるか（親の `[locale]/loading.tsx` で十分か、専用が必要か） |
| 2 | 遅いデータ取得（外部 API / 重い DB）を `<Suspense>` で分離したか |
| 3 | View に `ReactNode` slot で渡す構造にしているか |
| 4 | `error.tsx` がセグメントツリーのどこかでカバーしているか |
| 5 | 遷移に `next/link` or `@/shared/lib/i18n` の `Link` を使っているか |
| 6 | スケルトンは共有 `Skeleton` を使っているか |
| 7 | 認証チェックは shell 描画前に `await` しているか（Suspense 内に入れていないか） |

## 強制事項

このポリシーは **NON-NEGOTIABLE**。`.claude/rules/render-optimization.md`（描画の最小化）と対になり、「ナビゲーション時の体感速度」を担保する。

## 参考

- `.agents/skills/next-best-practices/suspense-boundaries.md`
- `.agents/skills/next-best-practices/data-patterns.md`
- `.agents/skills/vercel-react-best-practices/rules/async-suspense-boundaries.md`
- `.claude/rules/error-handling.md`
