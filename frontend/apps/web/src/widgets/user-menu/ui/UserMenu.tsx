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
import { LogOut, User } from 'lucide-react'
import { signOut } from '@/features/auth'

interface UserMenuProps {
  userEmail: string
}

/**
 * ユーザーメニュー（Client Component）
 * ドロップダウンメニューでユーザー情報とログアウトを表示
 */
export function UserMenu({ userEmail }: UserMenuProps) {
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
            <p className="text-sm font-medium leading-none">Account</p>
            <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-destructive" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
