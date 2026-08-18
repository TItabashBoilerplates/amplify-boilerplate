'use client'
import { createPressable } from '@gluestack-ui/core/pressable/creator'
import { type VariantProps, withStyleContext } from '@gluestack-ui/utils/nativewind-utils'
import { Pressable as RNPressable } from 'react-native'

import { pressableStyle } from './variants'

const UIPressable = createPressable({
  Root: withStyleContext(RNPressable),
})

type PressableProps = Omit<React.ComponentProps<typeof UIPressable>, 'context'> &
  VariantProps<typeof pressableStyle> & { className?: string }

/**
 * Mobile Pressable。フォーカス / disabled 状態のスタイルを持つ `Pressable` ラッパー。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function Pressable({ className, ...props }: PressableProps) {
  return <UIPressable {...props} className={pressableStyle({ class: className })} />
}
Pressable.displayName = 'Pressable'

export { pressableStyle } from './variants'
export type { PressableProps }
export { Pressable }
