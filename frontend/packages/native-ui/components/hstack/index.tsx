import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils'
import { View, type ViewProps } from 'react-native'
import { hstackStyle } from './variants'

type HStackProps = ViewProps & VariantProps<typeof hstackStyle> & { className?: string }

/**
 * Mobile HStack。横方向のスタックレイアウトプリミティブ。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function HStack({ className, space, reversed, ...props }: HStackProps) {
  return <View className={hstackStyle({ space, reversed, class: className })} {...props} />
}
HStack.displayName = 'HStack'

export { hstackStyle } from './variants'
export type { HStackProps }
export { HStack }
