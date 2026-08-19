---
description: "Page navigation - stream with loading.tsx + Suspense, navigate with links"
alwaysApply: true
globs: ["frontend/apps/web/**"]
---
# Page Navigation Policy

**MANDATORY**: ページ遷移は `loading.tsx` + `<Suspense>` でストリーミングする。

正本: `/.claude/rules/page-navigation.md`

## 必須

- データ取得を伴うセグメントに **`loading.tsx` を置く**（無いと遷移が「固まったように」見える）
- ページ内の遅い部分は **`<Suspense>` で個別に囲む**（速い部分を待たせない）
- スケルトンは**実寸に近い骨格**を出す（レイアウトシフトを避ける）
- 遷移は **`<a href>` / `next/link`**（`@/shared/lib/i18n` の `Link`）。
  `onClick` だけの `<button>` は禁止（新規タブ・戻る・クローラが壊れる）
- プログラム遷移は **next-intl の `useRouter()`**。
  `window.location.assign()` は**ロケール prefix が落ちる**ので使わない

## エラー境界

`error.tsx` / `global-error.tsx` を置き、**必ず `console.error` してから**再試行導線を出す
（`/.claude/rules/error-handling.md`）。
