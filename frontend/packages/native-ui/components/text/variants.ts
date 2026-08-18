import { tva } from '@gluestack-ui/utils/nativewind-utils'

/**
 * Mobile Text のクラス定義。
 *
 * 公式 gluestack-ui v5 の Text と同じ variant 群だが、`highlight`（`bg-yellow-500`）
 * だけは持たない。生パレット色になり `.claude/rules/frontend.md` の
 * セマンティックトークン限定ポリシーに反するため、対応する semantic token が
 * 増えるまでは意図的に外している。
 */
export const textStyle = tva({
  base: 'text-foreground font-normal',
  variants: {
    isTruncated: {
      true: 'truncate',
    },
    bold: {
      true: 'font-bold',
    },
    underline: {
      true: 'underline',
    },
    strikeThrough: {
      true: 'line-through',
    },
    size: {
      '2xs': 'text-2xs',
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
      '5xl': 'text-5xl',
      '6xl': 'text-6xl',
    },
    sub: {
      true: 'text-xs',
    },
    italic: {
      true: 'italic',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
