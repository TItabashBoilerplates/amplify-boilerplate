'use client'
import { createButton } from '@gluestack-ui/core/button/creator'
import {
  useStyleContext,
  type VariantProps,
  withStyleContext,
} from '@gluestack-ui/utils/nativewind-utils'
import type { ButtonSize, ButtonVariant } from '@workspace/tokens/contract'
import type * as React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { buttonIconStyle, buttonStyle, buttonTextStyle } from './variants'

const SCOPE = 'BUTTON'

type StyleContext = {
  variant?: ButtonVariant
  size?: ButtonSize
}

const UIButton = withStyleContext(Pressable, SCOPE)

const UIButtonText = ({
  className,
  ...props
}: React.ComponentProps<typeof Text> & { className?: string }) => {
  const { variant, size } = useStyleContext(SCOPE) as StyleContext
  return <Text className={buttonTextStyle({ variant, size, class: className })} {...props} />
}

const UIButtonSpinner = ({
  className,
  ...props
}: React.ComponentProps<typeof ActivityIndicator> & { className?: string }) => {
  return <ActivityIndicator className={className} {...props} />
}

const UIButtonIcon = ({
  className,
  as: AsComp,
  ...props
}: { className?: string; as?: React.ElementType } & Record<string, unknown>) => {
  const { variant, size } = useStyleContext(SCOPE) as StyleContext
  if (!AsComp) {
    return null
  }
  return <AsComp className={buttonIconStyle({ variant, size, class: className })} {...props} />
}

const UIButtonGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) => {
  return <View className={className} {...props} />
}

const AccessibleButton = createButton({
  Root: UIButton,
  Text: UIButtonText,
  Group: UIButtonGroup,
  Spinner: UIButtonSpinner,
  Icon: UIButtonIcon,
})

type ButtonProps = React.ComponentProps<typeof AccessibleButton> &
  VariantProps<typeof buttonStyle> & {
    className?: string
  }

/**
 * Mobile Button。
 *
 * `variant` / `size` は `@workspace/tokens/contract` が正本で、Web の
 * `@workspace/ui` の Button とまったく同じ API になっている。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <AccessibleButton
      className={buttonStyle({ variant, size, class: className })}
      context={{ variant, size }}
      {...props}
    />
  )
}
Button.displayName = 'Button'

const ButtonText = AccessibleButton.Text
const ButtonSpinner = AccessibleButton.Spinner
const ButtonIcon = AccessibleButton.Icon
const ButtonGroup = AccessibleButton.Group

export { buttonIconStyle, buttonStyle, buttonTextStyle } from './variants'
export type { ButtonProps }
export { Button, ButtonGroup, ButtonIcon, ButtonSpinner, ButtonText }
