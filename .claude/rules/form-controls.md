---
paths: frontend/**/*.{ts,tsx,js,jsx,css}
---

# Form Controls Policy（iOS Safari オートズーム禁止 + 共有コンポーネント必須）

**CRITICAL / NON-NEGOTIABLE**: **フォーカスでテキスト入力を受け付けるフォーム要素は、モバイル幅で
必ず computed font-size が 16px 以上**でなければならない。加えて、フォーム要素の見た目は
**必ず `@workspace/ui` の共有コンポーネント 1 か所**で定義する。ローカルの `xxxClass` 定数を
各画面にコピペすることを**禁止**する。

このルールは実際に発生した不具合の再発防止として制定されている。

---

## 1. 何が起きたか（実例・再発防止の対象）

| 事象 | iOS Safari でフォームにフォーカスすると勝手にズームインし、レイアウトが崩れて元に戻らない |
|---|---|
| **原因（ブラウザ挙動）** | **iOS Safari は font-size が 16px 未満のフォーム要素にフォーカスすると自動でズームインする**（Apple のアクセシビリティ挙動: 16px 未満は「読めない」とみなしてページを拡大する） |
| **原因（コード）** | `<textarea>` の**共有コンポーネントが存在せず**、`textareaClass` 定数が **6 ファイルにコピペで重複**。すべて `text-sm`(14px)、下書き本文だけ `text-xs`(12px) → **全部がズーム対象**だった |
| **なぜ気づけなかったか** | `Input`（`packages/ui/src/components/input.tsx`）は `text-base md:text-sm` で 16px を維持できていたため、「input は直っている＝全部直っている」と誤認した。**共有化されていない要素だけが取り残された** |

> **教訓**: これは「font-size の付け忘れ」ではなく、**重複コード（`.claude/rules/clean-code.md` 違反）が
> 引き起こした不具合**である。共有コンポーネントが 1 つあれば 1 箇所直すだけで済んだ。
> **フォーム要素を共有化せずに書いた時点でこのルール違反**とみなす。

---

## 2. 絶対ルール

### 2.1 モバイル幅で 16px 以上（必須）

```tsx
// ✅ 正: モバイルは 16px、md 以上でだけ 14px に落とす
className="text-base md:text-sm"

// ❌ 誤: モバイルでも 14px → iOS Safari がズームする
className="text-sm"

// ❌ 誤: 12px。最悪
className="text-xs"

// ❌ 誤: font-size を書かない（親から 14px を継承していればズームする）
className="rounded-md border px-3 py-2"
```

Tailwind のサイズ対応（root font-size = 16px 前提）:

| クラス | px | iOS ズーム |
|---|---|---|
| `text-xs` | 12px | **する** ❌ |
| `text-sm` | 14px | **する** ❌ |
| `text-base` | **16px** | しない ✅ |
| `text-lg` 以上 | 18px+ | しない ✅ |

**`text-base md:text-sm` を本リポジトリの標準形とする**（`Input` が既に採用済み。新規フォーム要素も
これに揃える）。デスクトップでは従来どおり 14px の見た目を保てるので、デザインを犠牲にしない。

> ⚠️ **`html { font-size: … }` を 16px 未満に下げてはならない**。`text-base` は `1rem` なので、
> root を縮めた瞬間に全フォーム要素がズーム対象に戻る。

### 2.2 対象要素 / 対象外要素

**対象（16px 必須）** — フォーカスでテキスト入力キャレットが立つもの:

| 要素 | 備考 |
|---|---|
| `<input type="text" \| "email" \| "password" \| "search" \| "tel" \| "url" \| "number">` | `Input` が対応済み |
| `<input type="date" \| "time" \| "datetime-local" \| "month" \| "week">` | ピッカー系も対象 |
| **`<textarea>`** | **今回の犯人。共有コンポーネント必須（§3）** |
| **ネイティブ `<select>`** | ネイティブ select はズームする |
| `contenteditable` な要素 | リッチテキストエディタ等 |
| 上記をラップする自作コンポーネント | `SearchBox` / `CommentField` 等、内部に input/textarea を持つもの全部 |

**対象外（`text-sm` 等のままでよい）**:

| 要素 | 理由 |
|---|---|
| `<input type="checkbox" \| "radio" \| "file" \| "range" \| "color" \| "submit" \| "button">` | フォーカスしてもズームしない |
| **Radix の `SelectTrigger`** | 実体が `<button>`。**ネイティブ `<select>` と違いズームしない** → `text-sm` のままでよい |
| Radix の `DropdownMenuTrigger` / `PopoverTrigger` 等 | 同上（`<button>`） |
| `<button>` / `<a>` / 通常のテキスト | 入力要素ではない |

> `SelectTrigger` を「select だから」と 16px に上げる必要はない。**実体が `<button>` か
> ネイティブ `<select>` か**で判断すること。

### 2.3 viewport での回避は禁止

```html
<!-- ❌ 絶対禁止: ズームは止まるが、低視力ユーザーがピンチ拡大できなくなる -->
<meta name="viewport" content="width=device-width, maximum-scale=1, user-scalable=no">
```

`maximum-scale=1` / `user-scalable=no` は確かにオートズームを止めるが、**WCAG 1.4.4 (Resize Text)
違反**であり axe 等の自動チェックでも failure として検出される。**font-size で解決すること**。
同様に `-webkit-text-size-adjust` による誤魔化しも使わない。

### 2.4 placeholder / 継承の罠

- **placeholder にも同じ font-size が効いていること**を確認する（別途 `placeholder:text-sm` のように
  小さく上書きするとズームの原因になる）。
- **`font-size: inherit` / font-size 未指定は禁止**。親が 14px なら 14px を継承してズームする。
  フォーム要素には**必ず明示的に font-size クラスを書く**。

---

## 3. 共有コンポーネント必須（重複コードの禁止）

**MANDATORY**: フォーム要素のスタイルは **`frontend/packages/ui/src/components/` の共有コンポーネント
1 か所**にのみ存在してよい。

```
frontend/packages/ui/src/components/
├── input.tsx      ✅ 共有コンポーネント（text-base md:text-sm）
├── textarea.tsx   ✅ 共有コンポーネント（同上）※ 存在しなければ追加してから使う
└── select.tsx     ✅ Radix ベース
```

### 禁止パターン

```tsx
// ❌ 絶対禁止: 各画面にローカルのクラス定数を置く（← 今回の不具合の根本原因）
const textareaClass = 'w-full rounded-md border px-3 py-2 text-sm'
const inputClass = '...'

// ❌ 禁止: 生の <textarea> を直書きする
<textarea className="text-sm ..." />

// ❌ 禁止: 「この画面だけ小さくしたい」で font-size を上書きする
<Textarea className="text-xs" />

// ✅ 正: 共有コンポーネントを import して使う
import { Textarea } from '@workspace/ui/components/textarea'
<Textarea placeholder={t('draft.placeholder')} />
```

### 新しいフォーム要素が必要になったとき

1. **まず `packages/ui/src/components/` に既存があるか確認**（無いのに直書きするのが最大の禁じ手）
2. 無ければ **shadcn/ui の公式コンポーネントとして追加**（`shadcn` / `shadcn-ui` Skill を先に起動）
3. **`text-base md:text-sm` を必ず含める**（`input.tsx` の className を手本にする）
4. **`.stories.tsx` を必ず作る**（`.claude/rules/ui-testing.md` により UI は Storybook で担保）
5. 既存のローカル定数・直書きは**すべて置換して削除**（`.claude/rules/clean-code.md`: 後方互換・重複を残さない）

---

## 4. 実装リファレンス

```tsx
// frontend/packages/ui/src/components/textarea.tsx
import type * as React from 'react'
import { cn } from '../lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // ↓ text-base md:text-sm が iOS Safari オートズーム対策の本体。絶対に外さない
        'border-input placeholder:text-muted-foreground dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

---

## 5. チェックリスト（フォーム実装・レビュー時に必ず実行）

1. 追加/変更したフォーム要素は **`@workspace/ui` の共有コンポーネント**を使っているか？
2. その共有コンポーネントの className に **`text-base`（+ 任意で `md:text-sm`）**が入っているか？
3. **`text-sm` / `text-xs` を入力要素に付けていないか？**（`className` での上書きも含む）
4. placeholder を小さく上書きしていないか？
5. ローカルの `xxxClass` 定数・生の `<textarea>` / `<input>` 直書きが残っていないか？
6. viewport に `maximum-scale` / `user-scalable=no` を足していないか？
7. Storybook のストーリーがあるか？

### 検出コマンド（レビュー時の自己チェック）

```bash
# ① 生の input/textarea/select 直書き（ヒットして良いのは packages/ui/src/components/ だけ）
grep -rn "<\(input\|textarea\|select\)[ >]" --include=*.tsx frontend/apps frontend/packages \
  | grep -v "packages/ui/src/components/"

# ② ローカルのクラス定数コピペが復活していないか（ヒット 0 が正常）
grep -rniE "const [a-z]*(textarea|input|field)[a-z]*Class(Name)? *=" --include=*.tsx \
  frontend/apps frontend/packages

# ③ 入力系コンポーネントに text-base が入っているか（目視確認用。ヒット行を 1 つずつ見る）
grep -rn "text-base\|text-sm\|text-xs" \
  --include='*input*.tsx' --include='*textarea*.tsx' --include='*field*.tsx' \
  --include='*form*.tsx' frontend/apps frontend/packages

# ④ viewport でズームを殺していないか（ヒット 0 が正常）
grep -rn "maximum-scale\|user-scalable" --include=*.tsx --include=*.ts --include=*.html \
  frontend/apps frontend/packages
```

> ①②④ は**ヒット 0 が正常**。③ はノイズを含むため（`file:text-sm` / `md:text-sm` / placeholder 等も
> 拾う）、**該当行を目視して「入力要素本体の font-size が `text-base` か」を確認**する。
> ドロップダウンメニュー項目・ラベル・`SelectItem` 等が `text-sm` なのは正常（入力要素ではない）。

### 実機確認

Storybook / dev サーバを **iOS Safari（実機 or Simulator）**で開き、**各フォーム要素にフォーカスして
ページが拡大しないこと**を確認する。デスクトップ Chrome の DevTools デバイスモードでは**この挙動は
再現しない**（＝ DevTools だけで OK と判断してはならない）。

---

## 6. Mobile (Expo / React Native) について

`apps/mobile` は WebView ではなくネイティブの `TextInput` を使うため、本ルールのオートズームは
**発生しない**。ただし、

- **`apps/mobile` でも「フォーム要素のスタイルは `packages/native-ui` の共有コンポーネントに集約する」
  という §3 の原則は同じく適用**される（コピペ定数の禁止）。
- **`react-native-web` / `use-dom` 経由で Web に出るコンポーネントは本ルールの対象**（実体が
  `<input>` / `<textarea>` になるため）。

**ただし「font-size が 16px 以上」はフォーム UI の要件のごく一部にすぎない。**
モバイルでは**キーボードが画面の約半分を覆う**ため、入力欄と送信ボタンがキーボードに
隠れないこと・オートフィル属性・Enter キーの意味・タップ標的サイズまで揃って初めて
「使えるフォーム」になる。**入力を含む画面を作る／直すときは、本ルールと合わせて必ず
`.claude/rules/mobile-uiux.md` と `.claude/skills/mobile-uiux/` に従うこと。**

---

## 7. 関連ルール

| ルール | 関係 |
|---|---|
| `.claude/rules/mobile-uiux.md` | **キーボード回避・入力属性（オートフィル / Enter キー / OTP）・タップ標的。本ルールと必ずセットで適用する** |
| `.claude/rules/clean-code.md` | 重複コード禁止 — 今回の根本原因。共有化されていない時点で違反 |
| `.claude/rules/ui-testing.md` | UI は Storybook 必須（単体テスト不要） |
| `.claude/rules/frontend.md` | デザインシステム共有（`@workspace/tokens` 正本） |
| `.claude/skills/shadcn-ui/` / `shadcn` Skill | コンポーネント追加時に**先に起動**（`skills-first.md`） |

---

## 8. 強制事項

このポリシーは**交渉の余地なし**。

- **入力要素にモバイル幅で 16px 未満の font-size を付ける実装は却下**する。
- **フォーム要素のクラス定数をローカルにコピペする実装は却下**する（共有コンポーネント化が必須）。
- **`maximum-scale` / `user-scalable=no` によるオートズーム回避は却下**する（WCAG 1.4.4 違反）。

### 出典

- [CSS-Tricks: 16px or Larger Text Prevents iOS Form Zoom](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)
- [Deque University (axe): Zooming and scaling must not be disabled](https://dequeuniversity.com/rules/axe/4.4/meta-viewport)
- [W3C WAI-ACT: Meta viewport allows for zoom](https://www.w3.org/WAI/standards-guidelines/act/rules/b4f0c3)
