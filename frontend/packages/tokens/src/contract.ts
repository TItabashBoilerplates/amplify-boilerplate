/**
 * Design System: Cross-platform Component Contract
 *
 * Web (shadcn/ui) / Mobile (gluestack-ui + NativeWind) / Desktop (Web 技術) で
 * **同じコンポーネント API** を保証するための契約。
 *
 * ## 何をここに置き、何を置かないか
 *
 * shadcn/ui の設計思想は「コンポーネントはセマンティックな CSS 変数トークンを参照する。
 * 変数を変えれば全コンポーネントが変わる」であり、**共有されるのはトークンであって
 * クラス文字列ではない**。React Native 側の正統ポートである react-native-reusables も
 * 同じモデル（同じコンポーネント名・同じトークン、コードはプラットフォーム別）を取る。
 *
 * | レイヤー | 共有するか | 置き場所 |
 * |---|---|---|
 * | 色・角丸トークン | ✅ 共有 | `colors.ts` / `radius.ts` → 生成 CSS |
 * | バリアント名・サイズ名・既定値 | ✅ 共有（このファイル） | `contract.ts` |
 * | 各バリアントが表現すべきセマンティックトークン | ✅ 共有（このファイル） | `contract.ts` |
 * | 実際の Tailwind クラス文字列 | ❌ 共有しない | 各プラットフォームの実装 |
 *
 * クラス文字列を共有しない理由: Web は `hover:` / `focus-visible:` / `shadow-xs` /
 * `[&_svg]` を必要とし、React Native はそれらを表現できない。共有すると
 * **最小公倍数まで Web を劣化させる**ことになる。
 *
 * ## 逸脱の防ぎ方
 *
 * - **名前の一致**: 各実装が `satisfies Record<ButtonVariant, string>` を付けるので、
 *   片方だけにバリアントを足す / 消すと **型エラー**になる。
 * - **トークン規律**: 実装が出力するクラス文字列に `BUTTON_SEMANTICS` のトークンが
 *   含まれ、かつ生パレット（`bg-zinc-900` / `text-white` など）を使っていないことを
 *   ユニットテストで検証する。
 */

export const BUTTON_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
] as const

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

export const BUTTON_SIZES = ['sm', 'default', 'lg', 'icon'] as const

export type ButtonSize = (typeof BUTTON_SIZES)[number]

export const BUTTON_DEFAULTS = {
  variant: 'default',
  size: 'default',
} as const satisfies { variant: ButtonVariant; size: ButtonSize }

/**
 * 各バリアントが **静止状態** で表現すべきセマンティックトークン。
 *
 * hover / focus は Web にしか無いので対象外。`ghost` は静止状態では背景も文字色も
 * 持たない（親から継承する）ため、要求トークンは空。
 */
export const BUTTON_SEMANTICS = {
  default: ['primary', 'primary-foreground'],
  secondary: ['secondary', 'secondary-foreground'],
  destructive: ['destructive', 'destructive-foreground'],
  outline: ['background', 'input'],
  ghost: [],
  link: ['primary'],
} as const satisfies Record<ButtonVariant, readonly string[]>

export const INPUT_SIZES = ['sm', 'default', 'lg'] as const

export type InputSize = (typeof INPUT_SIZES)[number]

export const INPUT_DEFAULTS = {
  size: 'default',
} as const satisfies { size: InputSize }

/**
 * 入力欄が表現すべきセマンティックトークン。
 *
 * バリアントを持たない（Web の shadcn Input も単一形）ので、状態ではなく
 * **枠・背景・文字**の 3 要素をトークンで表していることだけを担保する。
 * `aria-invalid` / `isInvalid` の見た目は `destructive` で表す。
 */
export const INPUT_SEMANTICS = ['input', 'background', 'foreground'] as const

/**
 * フォーム要素の最小フォントサイズ（px）。
 *
 * **iOS Safari は 16px 未満の入力欄にフォーカスすると自動でズームする**ため、
 * Web 側はモバイル幅で 16px 以上が必須（`.claude/rules/form-controls.md`）。
 * Native の `TextInput` はズームしないが、**同じ体感サイズに揃える**ために
 * 同じ下限を共有する。Tailwind では `text-base` = 16px。
 */
export const FORM_CONTROL_MIN_FONT_SIZE_PX = 16

/**
 * 生のパレット色・生の白黒を検出する正規表現。
 *
 * `.claude/rules/frontend.md` の「CSS 変数を使い、色をハードコードしない」を
 * 全プラットフォームで機械的に強制するために使う。
 */
export const RAW_COLOR_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|shadow|from|via|to|decoration|outline|caret|accent)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{1,3})\b/
