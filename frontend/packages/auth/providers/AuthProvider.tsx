'use client'

/**
 * 認証プロバイダーコンポーネント（Web / Client Component - SSR対応）
 *
 * @module @workspace/auth/providers/AuthProvider
 */

import { clientLogger } from '@workspace/logger/client'
import { Hub } from 'aws-amplify/utils'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { loadAuthUser } from '../lib/loadAuthUser'
import { useAuthStore } from '../store/authStore'

const logger = clientLogger.child({ provider: 'AuthProvider' })

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Amplify (Cognito) の認証状態を監視し Zustand ストアへ反映する。
 *
 * - 初回マウントで現在のユーザーを取得
 * - `Hub` の `auth` チャネルでサインイン/サインアウト/トークン更新を購読
 * - SSR ハイドレーションエラー防止のため `mounted` ガードを使用
 *
 * ```tsx
 * <AuthProvider>{children}</AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [mounted, setMounted] = useState(false)
  const setUser = useAuthStore((state) => state.setUser)
  const reset = useAuthStore((state) => state.reset)

  useEffect(() => {
    setMounted(true)

    const sync = () => {
      loadAuthUser().then((user) => (user ? setUser(user) : reset()))
    }

    // 初回取得
    sync()

    // 認証イベント購読
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

  // SSR 時はサーバー/クライアントの HTML 不一致を避けるため何も描画しない
  if (!mounted) {
    return null
  }

  return <>{children}</>
}
