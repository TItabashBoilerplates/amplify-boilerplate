'use client'
import { createInput } from '@gluestack-ui/core/input/creator'
import {
  useStyleContext,
  type VariantProps,
  withStyleContext,
} from '@gluestack-ui/utils/nativewind-utils'
import type { InputSize } from '@workspace/tokens/contract'
import type * as React from 'react'
import { TextInput, View } from 'react-native'

import { inputFieldStyle, inputIconStyle, inputStyle } from './variants'

const SCOPE = 'INPUT'

type StyleContext = {
  size?: InputSize
}

const UIInputRoot = withStyleContext(View, SCOPE)

const UIInputField = ({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & { className?: string }) => {
  const { size } = useStyleContext(SCOPE) as StyleContext
  return <TextInput className={inputFieldStyle({ size, class: className })} {...props} />
}

const UIInputIcon = ({
  className,
  as: AsComp,
  ...props
}: { className?: string; as?: React.ElementType } & Record<string, unknown>) => {
  const { size } = useStyleContext(SCOPE) as StyleContext
  if (!AsComp) {
    return null
  }
  return <AsComp className={inputIconStyle({ size, class: className })} {...props} />
}

const UIInputSlot = ({
  className,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) => (
  <View className={className} {...props} />
)

const AccessibleInput = createInput({
  Root: UIInputRoot,
  Icon: UIInputIcon,
  Slot: UIInputSlot,
  Input: UIInputField,
})

type InputVariantProps = VariantProps<typeof inputStyle>

export type InputProps = React.ComponentProps<typeof AccessibleInput> &
  InputVariantProps & { className?: string }

/**
 * Mobile の入力欄。
 *
 * Web の `@workspace/ui` の `Input` と**同じ役割・同じサイズ名**を持つ
 * （名前は `@workspace/tokens/contract` が正本）。
 *
 * ```tsx
 * <Input size="default" isInvalid={hasError}>
 *   <InputSlot className="pr-2"><InputIcon as={MailIcon} /></InputSlot>
 *   <InputField placeholder="you@example.com" autoComplete="email" />
 * </Input>
 * ```
 *
 * **`InputField` のフォントサイズを 14px 以下に上書きしないこと**
 * （`variants.ts` のコメント参照）。
 */
export function Input({ className, size, isInvalid, isDisabled, ...props }: InputProps) {
  return (
    <AccessibleInput
      context={{ size }}
      className={inputStyle({ size, isInvalid, isDisabled, class: className })}
      isInvalid={isInvalid}
      isDisabled={isDisabled}
      {...props}
    />
  )
}

export const InputField = AccessibleInput.Input
export const InputIcon = AccessibleInput.Icon
export const InputSlot = AccessibleInput.Slot
