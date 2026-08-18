import { tva } from '@gluestack-ui/utils/nativewind-utils'

/**
 * Mobile Icon のクラス定義。サイズは公式 gluestack-ui v5 の Icon と同じスケール。
 */
export const iconStyle = tva({
  base: 'text-foreground fill-none pointer-events-none',
  variants: {
    size: {
      '2xs': 'h-3 w-3',
      xs: 'h-3.5 w-3.5',
      sm: 'h-4 w-4',
      md: 'h-[18px] w-[18px]',
      lg: 'h-5 w-5',
      xl: 'h-6 w-6',
    },
  },
})
