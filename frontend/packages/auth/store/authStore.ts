import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

/**
 * 認証状態の型定義
 */
export interface AuthState {
  /**
   * 現在のユーザー情報
   */
  user: User | null

  /**
   * 現在のセッション情報
   */
  session: Session | null

  /**
   * 認証済みかどうか
   */
  isAuthenticated: boolean

  /**
   * 認証状態を設定
   * セッション情報から自動的にユーザー情報と認証状態を更新します
   *
   * @param session - Supabaseのセッション情報（nullの場合は未認証）
   */
  setAuth: (session: Session | null) => void

  /**
   * 認証状態をリセット
   */
  reset: () => void
}

/**
 * 認証状態管理用Zustandストア
 *
 * Supabaseの認証状態をグローバルに管理します。
 * AuthProviderからのみ更新され、コンポーネントから読み取り専用で使用されます。
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated } = useAuthStore()
 * ```
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,

  setAuth: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
    }),

  reset: () =>
    set({
      user: null,
      session: null,
      isAuthenticated: false,
    }),
}))
