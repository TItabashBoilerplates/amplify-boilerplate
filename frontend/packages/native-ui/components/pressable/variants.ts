import { tva } from '@gluestack-ui/utils/nativewind-utils'

/**
 * Mobile Pressable のクラス定義。
 *
 * 公式 gluestack-ui v5 は focus リングに `ring-indicator-info` を使うが、
 * このリポジトリには `indicator-*` トークンが無いため、既存の `--ring`
 * セマンティックトークン（`ring-ring`）に置き換えている。
 */
export const pressableStyle = tva({
  base: 'data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-ring data-[focus-visible=true]:ring-2 data-[disabled=true]:opacity-40',
})
