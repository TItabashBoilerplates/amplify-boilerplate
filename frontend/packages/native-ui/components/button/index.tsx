'use client'
import { createButton } from '@gluestack-ui/button'
import type { VariantProps } from '@gluestack-ui/nativewind-utils'
import { tva } from '@gluestack-ui/nativewind-utils/tva'
import { useStyleContext, withStyleContext } from '@gluestack-ui/nativewind-utils/withStyleContext'
import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

const SCOPE = 'BUTTON'

// Button variants using tva (Tailwind Variant Authority)
// Using standard Tailwind colors for React Native compatibility
const buttonStyle = tva({
  base: 'group/button rounded-lg flex-row items-center justify-center gap-2',
  variants: {
    action: {
      primary: 'bg-zinc-900',
      secondary: 'bg-zinc-100',
      positive: 'bg-green-500',
      negative: 'bg-red-500',
    },
    variant: {
      link: 'bg-transparent',
      outline: 'bg-transparent border border-zinc-300',
      solid: '',
    },
    size: {
      xs: 'px-3 h-8',
      sm: 'px-4 h-9',
      md: 'px-4 h-10',
      lg: 'px-6 h-11',
      xl: 'px-6 h-12',
    },
    isDisabled: {
      true: 'opacity-50',
    },
  },
  defaultVariants: {
    action: 'primary',
    variant: 'solid',
    size: 'md',
  },
})

const buttonTextStyle = tva({
  base: 'font-medium',
  variants: {
    action: {
      primary: 'text-white',
      secondary: 'text-zinc-900',
      positive: 'text-white',
      negative: 'text-white',
    },
    variant: {
      link: 'text-zinc-900 underline',
      outline: 'text-zinc-900',
      solid: '',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg',
    },
    isTruncated: {
      true: '',
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
    sub: {
      true: 'text-xs',
    },
    italic: {
      true: 'italic',
    },
    highlight: {
      true: 'bg-yellow-500',
    },
  },
  defaultVariants: {
    action: 'primary',
    variant: 'solid',
    size: 'md',
  },
})

const buttonSpinnerStyle = tva({
  base: '',
  variants: {
    action: {
      primary: '',
      secondary: '',
      positive: '',
      negative: '',
    },
  },
})

const buttonIconStyle = tva({
  base: '',
  variants: {
    action: {
      primary: 'text-white',
      secondary: 'text-zinc-900',
      positive: 'text-white',
      negative: 'text-white',
    },
    variant: {
      link: 'text-zinc-900',
      outline: 'text-zinc-900',
      solid: '',
    },
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
      xl: 'h-6 w-6',
    },
  },
  defaultVariants: {
    action: 'primary',
    variant: 'solid',
    size: 'md',
  },
})

// Raw components
const UIButton = withStyleContext(Pressable, SCOPE)

const UIButtonText = ({
  className,
  ...props
}: React.ComponentProps<typeof Text> & { className?: string }) => {
  const { action, variant, size } = useStyleContext(SCOPE)
  return (
    <Text className={buttonTextStyle({ action, variant, size, class: className })} {...props} />
  )
}

const UIButtonSpinner = ({
  className,
  ...props
}: React.ComponentProps<typeof ActivityIndicator> & { className?: string }) => {
  const { action } = useStyleContext(SCOPE)
  return (
    <ActivityIndicator className={buttonSpinnerStyle({ action, class: className })} {...props} />
  )
}

const UIButtonIcon = ({
  className,
  as: AsComp,
  ...props
}: { className?: string; as?: React.ElementType } & Record<string, unknown>) => {
  const { action, variant, size } = useStyleContext(SCOPE)
  if (AsComp) {
    return (
      <AsComp className={buttonIconStyle({ action, variant, size, class: className })} {...props} />
    )
  }
  return null
}

const UIButtonGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) => {
  return <View className={className} {...props} />
}

// Create the accessible button with gluestack primitives
const AccessibleButton = createButton({
  Root: UIButton,
  Text: UIButtonText,
  Group: UIButtonGroup,
  Spinner: UIButtonSpinner,
  Icon: UIButtonIcon,
})

// Export styled components
type ButtonProps = React.ComponentProps<typeof AccessibleButton> &
  VariantProps<typeof buttonStyle> & {
    className?: string
  }

const Button = React.forwardRef<React.ComponentRef<typeof UIButton>, ButtonProps>(
  ({ className, action, variant, size, ...props }, ref) => {
    return (
      <AccessibleButton
        ref={ref}
        className={buttonStyle({ action, variant, size, class: className })}
        context={{ action, variant, size }}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

const ButtonText = AccessibleButton.Text
const ButtonSpinner = AccessibleButton.Spinner
const ButtonIcon = AccessibleButton.Icon
const ButtonGroup = AccessibleButton.Group

export type { ButtonProps }
export { Button, ButtonGroup, ButtonIcon, ButtonSpinner, ButtonText }
