import { tva } from '@gluestack-ui/utils/nativewind-utils'

/**
 * Mobile Avatar のクラス定義。
 *
 * 公式 gluestack-ui v5 の `AvatarBadge` は既定で `bg-green-500`（オンライン表示）を
 * 持つが、生パレット色になり `.claude/rules/frontend.md` のセマンティックトークン
 * 限定ポリシーに反するため外している。バッジの色は利用側が意味に応じて
 * `className` で明示すること（例: `className="bg-primary"`）。
 */
export const avatarStyle = tva({
  base: 'relative h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted',
})

export const avatarFallbackTextStyle = tva({
  base: 'text-foreground text-xs font-medium uppercase',
})

export const avatarGroupStyle = tva({
  base: 'flex-row-reverse',
})

export const avatarBadgeStyle = tva({
  base: 'absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-background',
})

export const avatarImageStyle = tva({
  base: 'absolute h-full w-full rounded-full',
})
