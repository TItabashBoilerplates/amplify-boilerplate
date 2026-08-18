'use client'

/**
 * ユーザーメニューコンポーネント
 *
 * @module widgets/user-menu/ui/UserMenu
 */

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { LogOut, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { signOut } from '@/features/auth'
import { Link } from '@/shared/lib/i18n/navigation'

interface UserMenuProps {
  userEmail: string
}

/**
 * ユーザーメニュー（Client Component）
 * ドロップダウンメニューでユーザー情報とログアウトを表示
 */
export function UserMenu({ userEmail }: UserMenuProps) {
  const t = useTranslations('Auth')
  const tAccount = useTranslations('Account')

  const handleSignOut = async () => {
    await signOut()
  }

  // メールアドレスからイニシャルを生成
  const initial = userEmail.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar className="h-9 w-9 cursor-pointer transition-opacity hover:opacity-80">
          <AvatarFallback className="bg-primary text-primary-foreground">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="font-medium text-sm leading-none">{t('accountMenuLabel')}</p>
            <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* アカウント設定はメール変更 / パスワード変更 / 退会の必須導線への入口
            （`.claude/rules/auth.md` §2）。ここを消すとユーザーが到達できなくなる。 */}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/account">
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{tAccount('title')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-destructive" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
