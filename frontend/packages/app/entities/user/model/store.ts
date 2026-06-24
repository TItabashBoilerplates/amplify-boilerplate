/**
 * ユーザープロファイル用Zustandストア
 *
 * 認証状態とは別に、ユーザープロファイル情報を管理
 */

import { create } from 'zustand'
import type { AppUser } from './types'

export interface UserProfileState {
  /**
   * ユーザープロファイル情報
   */
  profile: AppUser | null

  /**
   * プロファイルローディング状態
   */
  isLoading: boolean

  /**
   * エラーメッセージ
   */
  error: string | null

  /**
   * プロファイルを設定
   */
  setProfile: (profile: AppUser | null) => void

  /**
   * ローディング状態を設定
   */
  setLoading: (isLoading: boolean) => void

  /**
   * エラーを設定
   */
  setError: (error: string | null) => void

  /**
   * 状態をリセット
   */
  reset: () => void
}

/**
 * ユーザープロファイル管理用ストア
 *
 * @example
 * ```tsx
 * const { profile, isLoading } = useUserProfileStore()
 * ```
 */
export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  setProfile: (profile) =>
    set({
      profile,
      error: null,
    }),

  setLoading: (isLoading) =>
    set({
      isLoading,
    }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  reset: () =>
    set({
      profile: null,
      isLoading: false,
      error: null,
    }),
}))
