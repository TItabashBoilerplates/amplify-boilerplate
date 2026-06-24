'use client'

/**
 * 認証プロバイダーコンポーネント
 *
 * @module @workspace/auth/providers/AuthProvider
 */

import { createClient } from '@workspace/client-supabase/client'
import { clientLogger } from '@workspace/logger/client'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

const logger = clientLogger.child({ provider: 'AuthProvider' })

/**
 * AuthProviderのProps
 */
interface AuthProviderProps {
  children: ReactNode
}

/**
 * 認証状態管理プロバイダー（Client Component - SSR対応）
 *
 * Supabaseの認証状態変更をリアルタイムで監視し、Zustandストアに反映します。
 * SSRハイドレーションエラーを防ぐため、`mounted`ガードを使用しています。
 *
 * ### SSR対策
 *
 * 1. **ハイドレーションエラー防止**: `mounted`状態でクライアント専用コードを保護
 * 2. **クライアント専用実行**: `useEffect`内でSupabase APIを呼び出し
 * 3. **SSR時は何もレンダリングしない**: `if (!mounted) return null`
 *
 * ### 使用方法
 *
 * layout.tsxで全体をラップ:
 * ```tsx
 * <AuthProvider>
 *   {children}
 * </AuthProvider>
 * ```
 *
 * @example
 * ```tsx
 * // コンポーネントから認証状態を取得
 * const { user, isAuthenticated } = useAuthStore()
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // SSRハイドレーションエラー防止用のマウント状態
  const [mounted, setMounted] = useState(false)

  // Zustandストアの更新関数を取得
  const { setAuth, reset } = useAuthStore()

  useEffect(() => {
    // クライアント側でのみ実行される
    setMounted(true)

    // ブラウザ専用のSupabaseクライアントを作成
    const supabase = createClient()

    // 初回セッション取得（エラーハンドリング付き）
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          logger.error('Failed to get initial session', { error: error.message })
          reset()
          return
        }

        setAuth(session)
      })
      .catch((error) => {
        logger.error('Unexpected error during session fetch', {
          error: error instanceof Error ? error.message : String(error),
        })
        reset()
      })

    // 認証状態変更のリアルタイム監視（エラーハンドリング付き）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // サインアウトイベントの処理
      if (event === 'SIGNED_OUT') {
        logger.info('User signed out')
        reset()
        return
      }

      // TOKEN_REFRESHED イベントなどでエラーが発生した場合
      if (!session && event === 'TOKEN_REFRESHED') {
        logger.error('Token refresh failed, session lost')
        reset()
        return
      }

      if (session) {
        // ログイン・セッション更新時
        setAuth(session)
      } else {
        // その他のログアウト時
        reset()
      }
    })

    // クリーンアップ: コンポーネントアンマウント時にサブスクリプション解除
    return () => {
      subscription.unsubscribe()
    }
  }, [setAuth, reset])

  // SSR時（サーバーレンダリング時）は何も表示しない
  // これによりサーバーとクライアントでHTMLの不一致を防ぐ
  if (!mounted) {
    return null
  }

  // クライアント側でマウント後、childrenをレンダリング
  return <>{children}</>
}
