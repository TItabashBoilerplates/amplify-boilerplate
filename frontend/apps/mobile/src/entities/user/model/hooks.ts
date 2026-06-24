import { useUserStore } from './store'

/**
 * 認証ユーザーを取得するフック
 */
export function useAuthUser() {
  const { user, isLoading } = useUserStore()
  return { user, isLoading }
}

/**
 * ユーザーストアのアクションを取得するフック
 */
export function useUserActions() {
  const { setUser, setLoading, clearUser } = useUserStore()
  return { setUser, setLoading, clearUser }
}
