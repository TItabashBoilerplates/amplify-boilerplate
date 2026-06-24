'use client'

/**
 * OneSignal + 認証連携フック
 *
 * 認証状態の変更を監視し、OneSignal のユーザー ID を自動的に同期する。
 *
 * ## 使用方法
 *
 * ```tsx
 * // 認証状態と OneSignal を連携させたいコンポーネントで使用
 * function AuthenticatedLayout({ children, user }) {
 *   useOneSignalAuth(user?.id)
 *   return <>{children}</>
 * }
 * ```
 *
 * ## 動作
 *
 * - userId が提供された場合: `OneSignal.login(userId)` を呼び出し
 * - userId が null/undefined の場合: `OneSignal.logout()` を呼び出し
 *
 * @module @workspace/onesignal/hooks
 */

import { useEffect, useRef } from 'react'
import { useOneSignalContext } from '../providers/OneSignalProvider'

/**
 * 認証状態と OneSignal を自動連携
 *
 * @param userId - ユーザーID（Supabase user.id）。null/undefined でログアウト
 *
 * @example
 * ```tsx
 * import { useOneSignalAuth } from '@workspace/onesignal/hooks'
 *
 * function DashboardLayout({ children }: { children: React.ReactNode }) {
 *   const { user } = useAuth()
 *   useOneSignalAuth(user?.id)
 *
 *   return <>{children}</>
 * }
 * ```
 */
export function useOneSignalAuth(userId: string | null | undefined): void {
  const { isInitialized, login, logout } = useOneSignalContext()
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // SDK が初期化されていない場合はスキップ
    if (!isInitialized) {
      return
    }

    // 前回と同じユーザー ID の場合はスキップ
    if (previousUserId.current === userId) {
      return
    }

    previousUserId.current = userId

    if (userId) {
      // ログイン: ユーザー ID を OneSignal に設定
      login(userId)
    } else {
      // ログアウト: ユーザー ID をクリア
      logout()
    }
  }, [isInitialized, userId, login, logout])
}
