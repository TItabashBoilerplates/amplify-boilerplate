import { tva } from '@gluestack-ui/utils/nativewind-utils'
import { INPUT_DEFAULTS, type InputSize } from '@workspace/tokens/contract'

/**
 * Mobile Input のクラス定義。
 *
 * **サイズ名・既定値は `@workspace/tokens/contract` が正本**で、
 * `satisfies Record<InputSize, string>` によりコンパイル時に Web と一致が保証される。
 * クラス文字列は Button と同じ理由でプラットフォーム別
 * （React Native に `focus-visible:` / `shadow-xs` / `file:` は無い）。
 *
 * ## フォントサイズを 16px 未満にしない
 *
 * Web 側は iOS Safari のオートズーム対策で 16px 以上が必須
 * （`.claude/rules/form-controls.md`）。Native の `TextInput` はズームしないが、
 * **同じ画面を Web ビルド（react-native-web）で出す可能性があり**、かつ
 * 体感サイズを揃えるべきなので同じ下限を守る。`text-base` = 16px。
 */
export const inputStyle = tva({
  base: 'flex-row items-center rounded-md border border-input bg-background',
  variants: {
    size: {
      sm: 'h-9 px-3',
      default: 'h-11 px-3',
      lg: 'h-12 px-4',
    } satisfies Record<InputSize, string>,
    isInvalid: {
      true: 'border-destructive',
      false: '',
    },
    isDisabled: {
      true: 'opacity-50',
      false: '',
    },
  },
  defaultVariants: INPUT_DEFAULTS,
})

export const inputFieldStyle = tva({
  base: 'flex-1 text-foreground',
  variants: {
    size: {
      // 16px 未満にしないこと（上のコメント参照）
      sm: 'text-base',
      default: 'text-base',
      lg: 'text-lg',
    } satisfies Record<InputSize, string>,
  },
  defaultVariants: INPUT_DEFAULTS,
})

export const inputIconStyle = tva({
  base: 'text-muted-foreground',
  variants: {
    size: {
      sm: 'h-4 w-4',
      default: 'h-4 w-4',
      lg: 'h-5 w-5',
    } satisfies Record<InputSize, string>,
  },
  defaultVariants: INPUT_DEFAULTS,
})
