import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils'
import { Text as RNText } from 'react-native'
import { textStyle } from './variants'

type TextProps = React.ComponentProps<typeof RNText> &
  VariantProps<typeof textStyle> & { className?: string }

/**
 * Mobile Text。
 *
 * `size` / `bold` / `isTruncated` などは公式 gluestack-ui v5 の Text と同じ props。
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function Text({
  className,
  isTruncated,
  bold,
  underline,
  strikeThrough,
  size,
  sub,
  italic,
  ...props
}: TextProps) {
  return (
    <RNText
      className={textStyle({
        isTruncated,
        bold,
        underline,
        strikeThrough,
        size,
        sub,
        italic,
        class: className,
      })}
      {...props}
    />
  )
}
Text.displayName = 'Text'

export { textStyle } from './variants'
export type { TextProps }
export { Text }
