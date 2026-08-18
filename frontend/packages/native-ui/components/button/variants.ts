import { tva } from '@gluestack-ui/utils/nativewind-utils'
import { BUTTON_DEFAULTS, type ButtonSize, type ButtonVariant } from '@workspace/tokens/contract'

/**
 * Mobile Button のクラス定義。
 *
 * **バリアント名・サイズ名・既定値は `@workspace/tokens/contract` が正本**で、
 * `satisfies Record<ButtonVariant, string>` によりコンパイル時に Web と一致が保証される。
 * 一方 **クラス文字列は意図的にプラットフォーム別**にしている:
 * React Native には `hover:` / `focus-visible:` / `shadow-*` / `[&_svg]` が無く、
 * Web と共有すると Web を最小公倍数まで劣化させてしまうため。
 *
 * 色は必ずセマンティックトークン（`bg-primary` / `text-foreground` ...）を使うこと。
 * 生パレット（`bg-zinc-900` / `text-white`）は `__tests__/variants.test.ts` が弾く。
 *
 * React Native 側の依存を持たない純粋モジュールにしてあるので、
 * Storybook / Vitest からもそのまま読める。
 */
export const buttonStyle = tva({
  base: 'flex-row items-center justify-center gap-2',
  variants: {
    variant: {
      default: 'bg-primary',
      secondary: 'bg-secondary',
      destructive: 'bg-destructive',
      outline: 'border border-input bg-background',
      ghost: 'bg-transparent',
      link: 'bg-transparent',
    } satisfies Record<ButtonVariant, string>,
    size: {
      sm: 'h-8 px-3 rounded-md',
      default: 'h-9 px-4 rounded-md',
      lg: 'h-10 px-6 rounded-md',
      icon: 'h-9 w-9 rounded-md',
    } satisfies Record<ButtonSize, string>,
    isDisabled: {
      true: 'opacity-50',
      false: '',
    },
  },
  defaultVariants: BUTTON_DEFAULTS,
})

export const buttonTextStyle = tva({
  base: 'font-medium',
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    } satisfies Record<ButtonVariant, string>,
    size: {
      sm: 'text-sm',
      default: 'text-sm',
      lg: 'text-base',
      icon: 'text-sm',
    } satisfies Record<ButtonSize, string>,
  },
  defaultVariants: BUTTON_DEFAULTS,
})

/**
 * Web の shadcn/ui は `[&_svg]:size-4` で子孫のアイコンを縮めるが、
 * React Native には子孫セレクタが無いのでアイコンへ直接当てる。
 */
export const buttonIconStyle = tva({
  base: '',
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      link: 'text-primary',
    } satisfies Record<ButtonVariant, string>,
    size: {
      sm: 'h-4 w-4',
      default: 'h-4 w-4',
      lg: 'h-5 w-5',
      icon: 'h-4 w-4',
    } satisfies Record<ButtonSize, string>,
  },
  defaultVariants: BUTTON_DEFAULTS,
})
