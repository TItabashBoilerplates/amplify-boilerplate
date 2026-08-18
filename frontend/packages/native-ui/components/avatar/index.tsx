'use client'
import { createAvatar } from '@gluestack-ui/core/avatar/creator'
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils'
import { withStyleContext } from '@gluestack-ui/utils/nativewind-utils'
import { Image, Text, View } from 'react-native'

import {
  avatarBadgeStyle,
  avatarFallbackTextStyle,
  avatarGroupStyle,
  avatarImageStyle,
  avatarStyle,
} from './variants'

const SCOPE = 'AVATAR'

const UIAvatar = createAvatar({
  Root: withStyleContext(View, SCOPE),
  Badge: View,
  Group: View,
  Image: Image,
  FallbackText: Text,
})

type AvatarProps = Omit<React.ComponentPropsWithoutRef<typeof UIAvatar>, 'context'> &
  VariantProps<typeof avatarStyle> & { className?: string }

/**
 * Mobile Avatar。Web の `@workspace/ui` Avatar とサブコンポーネント名を揃えている
 * （`Avatar` / `AvatarImage` / `AvatarFallback`）。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function Avatar({ className, ...props }: AvatarProps) {
  return <UIAvatar {...props} className={avatarStyle({ class: className })} context={{}} />
}
Avatar.displayName = 'Avatar'

type AvatarBadgeProps = React.ComponentPropsWithoutRef<typeof UIAvatar.Badge> &
  VariantProps<typeof avatarBadgeStyle> & { className?: string }

function AvatarBadge({ className, ...props }: AvatarBadgeProps) {
  return <UIAvatar.Badge {...props} className={avatarBadgeStyle({ class: className })} />
}
AvatarBadge.displayName = 'AvatarBadge'

type AvatarFallbackTextProps = React.ComponentPropsWithoutRef<typeof UIAvatar.FallbackText> &
  VariantProps<typeof avatarFallbackTextStyle> & { className?: string }

function AvatarFallbackText({ className, ...props }: AvatarFallbackTextProps) {
  return (
    <UIAvatar.FallbackText {...props} className={avatarFallbackTextStyle({ class: className })} />
  )
}
AvatarFallbackText.displayName = 'AvatarFallbackText'

type AvatarImageProps = React.ComponentPropsWithoutRef<typeof UIAvatar.Image> &
  VariantProps<typeof avatarImageStyle> & { className?: string }

function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <UIAvatar.Image
      {...props}
      className={avatarImageStyle({ class: className })}
      resizeMode="cover"
    />
  )
}
AvatarImage.displayName = 'AvatarImage'

type AvatarGroupProps = React.ComponentPropsWithoutRef<typeof UIAvatar.Group> &
  VariantProps<typeof avatarGroupStyle> & { className?: string }

function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return <UIAvatar.Group {...props} className={avatarGroupStyle({ class: className })} />
}
AvatarGroup.displayName = 'AvatarGroup'

// shadcn/ui との命名互換のためのエイリアス（Web の Avatar/AvatarFallback/AvatarImage と揃える）
const AvatarFallback = AvatarFallbackText

export {
  avatarBadgeStyle,
  avatarFallbackTextStyle,
  avatarGroupStyle,
  avatarImageStyle,
  avatarStyle,
} from './variants'
export type {
  AvatarBadgeProps,
  AvatarFallbackTextProps,
  AvatarGroupProps,
  AvatarImageProps,
  AvatarProps,
}
export { Avatar, AvatarBadge, AvatarFallback, AvatarFallbackText, AvatarGroup, AvatarImage }
