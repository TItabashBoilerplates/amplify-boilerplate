# Web のモバイル（ビューポート・キーボード・レスポンシブ）

対象: `frontend/apps/web`（Next.js 16 / React 19 / TailwindCSS 4 / shadcn/ui）と
`frontend/packages/ui`。**「モバイルアプリを出さない Web だけのプロダクト」でも適用する** —
モバイル Web でもキーボードは画面の半分を覆う。

---

## 1. ビューポート meta（Next.js の `viewport` export）

Next.js App Router では `layout.tsx` から `viewport` をエクスポートする。

```ts
// apps/web/app/[locale]/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',            // env(safe-area-inset-*) を有効にする
  // interactiveWidget: 'resizes-content',   // ← §2 を読んでから判断する
}
```

### ⚠️ Next.js 公式サンプルのコピー禁止

**公式ドキュメント（`generateViewport`）のコード例には
`maximumScale: 1, userScalable: false` がそのまま載っている。** これは

- **WCAG 1.4.4（Resize Text）違反**
- axe / Deque のルール "Zooming and scaling must not be disabled" で failure

にあたる。**絶対にコピーしない。** iOS Safari のオートズームは
**フォーム要素の font-size を 16px 以上**にして止める（`.claude/rules/form-controls.md`）。

---

## 2. `interactive-widget`：キーボードが出たときに何が縮むか

仮想キーボード表示時のビューポート挙動を決めるキー（CSS Viewport Module Level 1）。

| 値 | 挙動 | 既定になっているブラウザ |
|---|---|---|
| `resizes-visual` | **visual viewport だけ**縮む。レイアウトビューポートは不変 | **Safari (iOS/iPadOS)** / Chrome (iOS, iPadOS, ChromeOS) / Edge (iOS) |
| `resizes-content` | **visual + layout の両方**が縮む | **Chrome / Firefox / Edge (Android)** / Firefox (iOS) |
| `overlays-content` | どちらも縮まず、キーボードがコンテンツに重なる | — |

### ここから導かれる 2 つの事実

1. **iOS Safari では `position: fixed` の下部バーがキーボードの裏に残る。**
   レイアウトビューポートが縮まないため、`bottom: 0` はキーボードの下のままになる。
2. **`dvh` / `svh` / `lvh` は仮想キーボードに反応しない。**
   これらはレイアウトビューポート（Initial Containing Block）由来なので、
   `resizes-visual` の間は値が変わらない。

`resizes-content` を指定するとレイアウトビューポートが縮み、`dvh` も `position: fixed` も
キーボードに追従するようになる。ただし**レイアウトが再計算されるためリフローが起きる**ので、
「下部固定バーがある画面がある」ときに選ぶ。

```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}
```

> **`interactiveWidget` はアプリ全体（そのレイアウト配下）に効く。** 特定画面のためだけに
> 全体の挙動を変えるかは、下部固定 UI の有無で判断する。判断が割れるならユーザーに確認する。

---

## 3. セーフエリア（ノッチ / ホームインジケータ）

`viewport-fit=cover` と `env()` はセットで使う。

```css
/* 下部固定バー */
.bottom-bar {
  position: sticky;   /* または fixed */
  bottom: 0;
  padding-block-end: calc(1rem + env(safe-area-inset-bottom));
}
```

利用できる変数:

| 変数 | 用途 |
|---|---|
| `safe-area-inset-top/right/bottom/left` | ノッチ・角丸・ホームインジケータの回避 |
| `safe-area-max-inset-*` | 動的 UI が引っ込んだときの最大値（静的） |
| `titlebar-area-*` | デスクトップ PWA の Window Controls Overlay |
| **`keyboard-inset-*`** | **VirtualKeyboard API 前提。§4 参照** |

Tailwind では任意値で書ける: `pb-[calc(1rem+env(safe-area-inset-bottom))]`。
**複数箇所で使うならユーティリティを `@workspace/ui` 側に 1 つ作る**（コピペしない）。

---

## 4. `env(keyboard-inset-*)` に依存しない

`keyboard-inset-top` などは **VirtualKeyboard API**（`navigator.virtualKeyboard.overlaysContent = true`）
を有効にした場合のみ値が入る。**Chromium 系限定**で、iOS Safari では常に 0 になる。

→ **「Android では直ったが iOS でだけ壊れている」実装**になるので、これを主たる手段にしない。
どうしても精密な制御が要る場合は **VisualViewport API** を使う。

```ts
// キーボード表示中の visual viewport 高さを CSS 変数に反映する（必要なときだけ）
const vv = window.visualViewport
if (vv) {
  const sync = () => {
    document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
  sync()
}
```

- **まず `interactive-widget` と `dvh` で足りないか検討する。** JS のリスナーは
  スクロール中に毎フレーム走るため、安易に入れると体感が落ちる。
- 入れる場合はクリーンアップ必須（`.claude/rules/render-optimization.md`）。

---

## 5. フォーカスされた入力が固定バーの裏に入る

ブラウザは focus 時に入力を自動スクロールするが、**固定ヘッダー / 固定フッターの存在は
考慮しない**。入力側に `scroll-margin` を付ける。

```css
input, textarea, select {
  scroll-margin-block: 6rem;   /* 固定ヘッダー / フッターの高さぶん */
}
```

---

## 6. モバイル幅のモーダルは Drawer

- **スマホ幅では中央 Dialog を使わない。** 縦の余白が足りず、キーボードが出ると
  ダイアログ本体が押し出される／隠れる。**下から出る Drawer（シート）**にする。
- shadcn/ui も「モバイルは Drawer、デスクトップは Dialog」を推奨しており、
  `useIsMobile`（既定ブレークポイント **768px = Tailwind `md`**）で切り替えるのが標準形。
- **切り替えロジックを画面ごとに書かない。** `@workspace/ui` に
  「レスポンシブなモーダル」を 1 つ用意して全画面から使う（`.claude/rules/clean-code.md`）。
- `@workspace/ui` に `Drawer` が無い場合は**まず `shadcn` Skill を起動**してから公式手順で追加する
  （手書きで再現しない — `.claude/rules/minimal-implementation.md`）。

```tsx
// 概念図。実体は @workspace/ui に 1 か所だけ置く
const isMobile = useIsMobile()          // matchMedia('(max-width: 767px)')
return isMobile ? <Drawer …/> : <Dialog …/>
```

> **`useIsMobile` を SSR で使うときはハイドレーション不整合に注意**
> （初回レンダーはサーバー側で判定できない）。`frontend/CLAUDE.md` の
> 「Rule 2: Client Component = Use `mounted` Flag」に従う。
> **UA 判定でモバイルを決めない**（ビューポート幅で判定する）。

---

## 7. レスポンシブの原則（shadcn / Tailwind 4）

- **モバイルファースト**: 素のクラスがモバイル、`md:` 以上でデスクトップ用に上書きする
  （`text-base md:text-sm` がまさにこの形）。
- **固定 px の幅・高さを画面に置かない。** `max-w-*` + `w-full`。
- **横スクロールを発生させない。** 幅の広いもの（テーブル・コードブロック・チャート）は
  `overflow-x-auto` の**内側**に閉じ込める。`body` が横スクロールしたら不具合。
- **`100vh` はモバイルでアドレスバーぶんずれる** → `100dvh`（`svh` / `lvh` も用途で使い分け）。
- **ホバー前提の UI を作らない。** タッチにはホバーが無い。
  重要な情報を `hover:` でしか出さない設計は、モバイルで到達不能になる。
  `@media (hover: hover)` で分岐する。
- **タップ標的は 44×44 以上**（`touch-and-layout.md`）。
- 色・トークンは `@workspace/tokens`（生パレット禁止 — `.claude/rules/frontend.md`）。

---

## 8. 検証

- **DevTools のデバイスモードは、仮想キーボードもセーフエリアもエミュレートしない。**
  幅を狭めただけで「モバイル確認済み」としない。
- **実機の iOS Safari** で: フォーカス時にズームしないか / 下部バーが隠れないか /
  ホームインジケータに被らないか。
- **実機の Android Chrome** で: レイアウトが縮むこと前提の作りが崩れていないか。
- Lighthouse / axe でタップ標的とビューポートの failure を確認する。

---

## 出典

- [Next.js: generateViewport](https://nextjs.org/docs/app/api-reference/functions/generate-viewport) — `viewportFit` / `interactiveWidget`（サンプルの `userScalable: false` は採用しない）
- [viewport-resize-behavior explainer（CSS Viewport Module Level 1）](https://github.com/bramus/viewport-resize-behavior/blob/main/explainer.md) — 3 つの値と既定のブラウザ
- [MDN: `env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env) — `safe-area-inset-*` / `keyboard-inset-*`（VirtualKeyboard API 前提）
- [MDN: VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
- [shadcn/ui: Drawer](https://ui.shadcn.com/docs/components/drawer) — モバイルは Drawer / デスクトップは Dialog
- [Deque University: Zooming and scaling must not be disabled](https://dequeuniversity.com/rules/axe/4.4/meta-viewport)
