'use client'

/**
 * useAuth - 認証フック
 *
 * @module @workspace/auth/hooks/useAuth
 */

import { useShallow } from 'zustand/shallow'
import { useAuthStore } from '../store/authStore'

/**
 * 認証状態を取得する便利フック
 *
 * Zustandストアから認証状態を取得します。
 * useAuthStoreのラッパーとして、より使いやすいAPIを提供します。
 *
 * パフォーマンス最適化のため、useShallow（shallow比較）を使用しています。
 * これにより、関連する状態が変更されたときのみ再レンダリングされます。
 *
 * @returns 認証状態オブジェクト
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated } = useAuth()
 *
 *   if (!isAuthenticated) {
 *     return <p>Not logged in</p>
 *   }
 *
 *   return <p>Welcome, {user?.email}</p>
 * }
 * ```
 */
export function useAuth() {
  const { user, session, isAuthenticated } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      session: state.session,
      isAuthenticated: state.isAuthenticated,
    }))
  )

  return {
    /** 現在のユーザー情報 */
    user,
    /** 現在のセッション情報 */
    session,
    /** 認証済みかどうか */
    isAuthenticated,
  }
}
