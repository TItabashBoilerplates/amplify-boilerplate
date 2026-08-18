import {
  createIcon,
  type IPrimitiveIcon,
  PrimitiveIcon,
  Svg,
} from '@gluestack-ui/core/icon/creator'
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils'
import { styled } from 'nativewind'

import { iconStyle } from './variants'

/**
 * Mobile Icon。
 *
 * `@gluestack-ui/core/icon/creator` の `createIcon` をそのまま使う（公式パターン）。
 * 事前定義アイコン集は持たない。個別アイコンが要る場面では
 * `lucide-react-native`（`.claude/skills/gluestack-ui-v5` の Icon Resolution Hierarchy）
 * か、下の `createIcon` ヘルパーでカスタム SVG を作ること。
 */
export const UIIcon = createIcon({
  Root: PrimitiveIcon,
}) as React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof PrimitiveIcon> &
    React.RefAttributes<React.ComponentRef<typeof Svg>>
>

const StyledUIIcon = styled(UIIcon, { className: 'style' })

type IconProps = IPrimitiveIcon &
  VariantProps<typeof iconStyle> &
  React.ComponentPropsWithoutRef<typeof UIIcon> & { className?: string }

/**
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function Icon({ size = 'md', className, ...props }: IconProps) {
  if (typeof size === 'number') {
    return <StyledUIIcon {...props} className={iconStyle({ class: className })} size={size} />
  }
  if ((props.height !== undefined || props.width !== undefined) && size === undefined) {
    return <StyledUIIcon {...props} className={iconStyle({ class: className })} />
  }
  return <StyledUIIcon {...props} className={iconStyle({ size, class: className })} />
}

type CreateIconParams = Omit<Parameters<typeof createIcon>[0], 'Root'>

/**
 * カスタム SVG アイコンを作るためのヘルパー。`Root: Svg` で `createIcon` をラップし、
 * `iconStyle` のサイズスケールを自動適用する。
 */
function createIconUI({ ...props }: CreateIconParams) {
  const UIIconCreateIcon = createIcon({
    Root: Svg,
    ...props,
  }) as React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof PrimitiveIcon> &
      React.RefAttributes<React.ComponentRef<typeof Svg>>
  >

  function CreatedIcon({
    className,
    size,
    ...restProps
  }: VariantProps<typeof iconStyle> &
    React.ComponentPropsWithoutRef<typeof UIIconCreateIcon> & {
      className?: string
    }) {
    return <UIIconCreateIcon {...restProps} className={iconStyle({ size, class: className })} />
  }

  return CreatedIcon
}

export { iconStyle } from './variants'
export type { IconProps }
export { createIconUI as createIcon, Icon }
