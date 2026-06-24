import { create } from 'zustand'
import type { AuthUser, User } from './types'

/**
 * ユーザーストアの状態
 */
interface UserState {
  /**
   * 認証ユーザー（Supabase Auth）
   */
  authUser: AuthUser | null

  /**
   * ユーザー情報（users）
   */
  user: User | null

  /**
   * 認証ユーザーをセット
   */
  setAuthUser: (authUser: AuthUser | null) => void

  /**
   * ユーザー情報をセット
   */
  setUser: (user: User | null) => void

  /**
   * すべてのユーザー情報をクリア
   */
  clearUser: () => void
}

/**
 * ユーザー情報を管理するZustandストア
 *
 * @example
 * ```tsx
 * import { useUserStore } from '@/entities/user'
 *
 * function UserName() {
 *   const user = useUserStore((state) => state.user)
 *
 *   return <p>{user?.displayName}</p>
 * }
 * ```
 */
export const useUserStore = create<UserState>((set) => ({
  authUser: null,
  user: null,

  setAuthUser: (authUser) =>
    set({
      authUser,
    }),

  setUser: (user) =>
    set({
      user,
    }),

  clearUser: () =>
    set({
      authUser: null,
      user: null,
    }),
}))
