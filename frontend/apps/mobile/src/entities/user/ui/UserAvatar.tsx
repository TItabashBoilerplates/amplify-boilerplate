import { ThemedText } from '@workspace/native-ui/layout'
import { Image, View } from 'react-native'

interface UserAvatarProps {
  avatarUrl?: string | null
  displayName?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

/**
 * ユーザーアバターコンポーネント
 */
export function UserAvatar({ avatarUrl, displayName, size = 'md' }: UserAvatarProps) {
  const sizeClass = sizeClasses[size]

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} className={`${sizeClass} rounded-full`} />
  }

  // フォールバック: イニシャル表示
  const initial = displayName?.charAt(0).toUpperCase() ?? '?'

  return (
    <View
      className={`${sizeClass} rounded-full bg-zinc-200 dark:bg-zinc-700 items-center justify-center`}
    >
      <ThemedText type="defaultSemiBold">{initial}</ThemedText>
    </View>
  )
}
