import { tva } from '@gluestack-ui/utils/nativewind-utils'

/**
 * Mobile VStack のクラス定義。`space` prop は className の `gap-*` の代わりに使う
 * （`.claude/skills/gluestack-ui-v5` の Rule 2: Component Props over className）。
 * 色を持たないレイアウトプリミティブなので Web 側との契約は不要。
 */
export const vstackStyle = tva({
  base: 'flex-col',
  variants: {
    space: {
      xs: 'gap-1',
      sm: 'gap-2',
      md: 'gap-3',
      lg: 'gap-4',
      xl: 'gap-5',
      '2xl': 'gap-6',
      '3xl': 'gap-7',
      '4xl': 'gap-8',
    },
    reversed: {
      true: 'flex-col-reverse',
    },
  },
})
