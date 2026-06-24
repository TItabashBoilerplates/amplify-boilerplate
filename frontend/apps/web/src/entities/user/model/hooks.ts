import { useUserStore } from './store'

/**
 * 認証ユーザー情報を取得するフック
 *
 * @returns 認証ユーザー情報とストア操作関数
 *
 * @example
 * ```tsx
 * import { useAuthUser } from '@/entities/user'
 *
 * function Component() {
 *   const { authUser, setAuthUser, clearUser } = useAuthUser()
 *
 *   if (!authUser) return <div>Not authenticated</div>
 *
 *   return <div>User ID: {authUser.id}</div>
 * }
 * ```
 */
export function useAuthUser() {
  const authUser = useUserStore((state) => state.authUser)
  const setAuthUser = useUserStore((state) => state.setAuthUser)
  const clearUser = useUserStore((state) => state.clearUser)

  return {
    authUser,
    setAuthUser,
    clearUser,
  }
}

/**
 * ユーザー情報を取得するフック
 *
 * @returns ユーザー情報とストア操作関数
 *
 * @example
 * ```tsx
 * import { useUser } from '@/entities/user'
 *
 * function UserName() {
 *   const { user, setUser } = useUser()
 *
 *   if (!user) return null
 *
 *   return <p>{user.displayName}</p>
 * }
 * ```
 */
export function useUser() {
  const user = useUserStore((state) => state.user)
  const setUser = useUserStore((state) => state.setUser)

  return {
    user,
    setUser,
  }
}
