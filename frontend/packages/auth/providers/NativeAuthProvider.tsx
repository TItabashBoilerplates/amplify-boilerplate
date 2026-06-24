/**
 * React Native用認証プロバイダーコンポーネント
 *
 * @module @workspace/auth/providers/NativeAuthProvider
 */

import { createClient } from '@workspace/client-supabase/native'
import { clientLogger } from '@workspace/logger/client'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

const logger = clientLogger.child({ provider: 'NativeAuthProvider' })

/**
 * NativeAuthProviderのProps
 */
interface NativeAuthProviderProps {
  children: ReactNode
}

/**
 * React Native用認証状態管理プロバイダー
 *
 * Supabaseの認証状態変更をリアルタイムで監視し、Zustandストアに反映します。
 * AsyncStorageを使用してセッションを永続化します。
 *
 * ### 使用方法
 *
 * _layout.tsxで全体をラップ:
 * ```tsx
 * import { NativeAuthProvider } from '@workspace/auth/providers/native'
 *
 * export default function RootLayout() {
 *   return (
 *     <NativeAuthProvider>
 *       <Stack />
 *     </NativeAuthProvider>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // コンポーネントから認証状態を取得
 * import { useAuthStore } from '@workspace/auth'
 *
 * const { user, isAuthenticated } = useAuthStore()
 * ```
 */
export function NativeAuthProvider({ children }: NativeAuthProviderProps) {
  const [loading, setLoading] = useState(true)
  const { setAuth, reset } = useAuthStore()

  useEffect(() => {
    // Native用のSupabaseクライアントを作成
    const supabase = createClient()

    // 初回セッション取得（AsyncStorageから復元）
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          logger.error('Failed to get initial session', { error: error.message })
          reset()
        } else {
          setAuth(session)
        }
      })
      .catch((error) => {
        logger.error('Unexpected error during session fetch', {
          error: error instanceof Error ? error.message : String(error),
        })
        reset()
      })
      .finally(() => {
        setLoading(false)
      })

    // 認証状態変更のリアルタイム監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        logger.info('User signed out')
        reset()
        return
      }

      if (!session && event === 'TOKEN_REFRESHED') {
        logger.error('Token refresh failed, session lost')
        reset()
        return
      }

      if (session) {
        setAuth(session)
      } else {
        reset()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setAuth, reset])

  // ローディング中はnullを返す（スプラッシュスクリーンと組み合わせて使用）
  if (loading) {
    return null
  }

  return <>{children}</>
}
