/**
 * React Native 用認証プロバイダーコンポーネント
 *
 * @module @workspace/auth/providers/NativeAuthProvider
 */

import { clientLogger } from '@workspace/logger/client'
import { Hub } from 'aws-amplify/utils'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { loadAuthUser } from '../lib/loadAuthUser'
import { useAuthStore } from '../store/authStore'

const logger = clientLogger.child({ provider: 'NativeAuthProvider' })

interface NativeAuthProviderProps {
  children: ReactNode
}

/**
 * Amplify (Cognito) の認証状態を監視し Zustand ストアへ反映する（React Native 用）。
 *
 * Amplify はトークンを安全なストレージに永続化する。`Hub` の `auth` チャネルで
 * 認証イベントを購読し、初回はスプラッシュと組み合わせるため `loading` ガードを使う。
 *
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
 */
export function NativeAuthProvider({ children }: NativeAuthProviderProps) {
  const [loading, setLoading] = useState(true)
  const setUser = useAuthStore((state) => state.setUser)
  const reset = useAuthStore((state) => state.reset)

  useEffect(() => {
    const sync = () => loadAuthUser().then((user) => (user ? setUser(user) : reset()))

    // 初回取得（永続化されたセッションから復元）
    sync().finally(() => setLoading(false))

    const stopListening = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'tokenRefresh':
          sync()
          break
        case 'signedOut':
          logger.info('User signed out')
          reset()
          break
        case 'tokenRefresh_failure':
          logger.error('Token refresh failed, session lost')
          reset()
          break
        default:
          break
      }
    })

    return () => {
      stopListening()
    }
  }, [setUser, reset])

  // ローディング中は null（スプラッシュスクリーンと併用）
  if (loading) {
    return null
  }

  return <>{children}</>
}
