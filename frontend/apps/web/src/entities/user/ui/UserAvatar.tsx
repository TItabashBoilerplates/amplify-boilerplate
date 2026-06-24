'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { User } from 'lucide-react'
import type { User as UserType } from '../model/types'

interface UserAvatarProps {
  user: UserType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * ユーザーアバターコンポーネント
 *
 * @param user - ユーザー情報
 * @param size - アバターのサイズ（sm: 32px, md: 40px, lg: 48px）
 * @param className - 追加のCSSクラス
 *
 * @example
 * ```tsx
 * import { UserAvatar } from '@/entities/user'
 *
 * function Component({ user }) {
 *   return <UserAvatar user={user} size="md" />
 * }
 * ```
 */
export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  // 表示名の最初の文字を取得（フォールバック用）
  const initial =
    user.display_name?.charAt(0).toUpperCase() || user.account_name.charAt(0).toUpperCase()

  return (
    <Avatar className={`${sizeClasses[size]} ${className ?? ''}`}>
      {/* TODO: プロフィール画像URLがある場合は表示 */}
      <AvatarImage src={undefined} alt={user.display_name || user.account_name} />
      <AvatarFallback>{initial || <User className="h-4 w-4" />}</AvatarFallback>
    </Avatar>
  )
}
