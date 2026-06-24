'use client'

/**
 * 認証セレクタフック
 *
 * @module @workspace/auth/hooks/useAuth
 */

import { useShallow } from 'zustand/shallow'
import { useAuthStore } from '../store/authStore'

/**
 * 認証ユーザーだけを購読する（user 変更時のみ再描画）。
 */
export function useAuthUser() {
  return useAuthStore((state) => state.user)
}

/**
 * 認証済みフラグだけを購読する（boolean 変更時のみ再描画）。
 */
export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated)
}

/**
 * user / isAuthenticated をまとめて取得する便利フック（shallow 比較）。
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated } = useAuth()
 * ```
 */
export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    }))
  )
}
