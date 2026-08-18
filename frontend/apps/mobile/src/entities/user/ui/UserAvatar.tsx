import { Avatar, AvatarFallbackText, AvatarImage } from '@workspace/native-ui/components'

interface UserAvatarProps {
  avatarUrl?: string | null
  displayName?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
}

/**
 * ユーザーアバターコンポーネント
 */
export function UserAvatar({ avatarUrl, displayName, size = 'md' }: UserAvatarProps) {
  const initial = displayName?.charAt(0).toUpperCase() ?? '?'

  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarFallbackText>{initial}</AvatarFallbackText>
      {avatarUrl && <AvatarImage source={{ uri: avatarUrl }} />}
    </Avatar>
  )
}
