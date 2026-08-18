import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils'
import { View, type ViewProps } from 'react-native'
import { vstackStyle } from './variants'

type VStackProps = ViewProps & VariantProps<typeof vstackStyle> & { className?: string }

/**
 * Mobile VStack。縦方向のスタックレイアウトプリミティブ。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function VStack({ className, space, reversed, ...props }: VStackProps) {
  return <View className={vstackStyle({ space, reversed, class: className })} {...props} />
}
VStack.displayName = 'VStack'

export { vstackStyle } from './variants'
export type { VStackProps }
export { VStack }
