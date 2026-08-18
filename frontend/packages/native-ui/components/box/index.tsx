import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils'
import { View, type ViewProps } from 'react-native'
import { boxStyle } from './variants'

type BoxProps = ViewProps & VariantProps<typeof boxStyle> & { className?: string }

/**
 * Mobile Box。汎用レイアウトプリミティブ（`View` のセマンティックラッパー）。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function Box({ className, ...props }: BoxProps) {
  return <View className={boxStyle({ class: className })} {...props} />
}
Box.displayName = 'Box'

export { boxStyle } from './variants'
export type { BoxProps }
export { Box }
