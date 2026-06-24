'use client'

/**
 * OneSignal Web Push プロバイダー
 *
 * Next.js App Router で使用する OneSignal SDK のプロバイダー。
 * AuthProvider の後にラップすることで、認証状態との連携が可能。
 *
 * ## 使用方法
 *
 * ```tsx
 * // app/[locale]/layout.tsx
 * <QueryProvider>
 *   <AuthProvider>
 *     <OneSignalProvider appId={process.env.NEXT_PUBLIC_ONE_SIGNAL_APP_ID!}>
 *       <NextIntlClientProvider>
 *         {children}
 *       </NextIntlClientProvider>
 *     </OneSignalProvider>
 *   </AuthProvider>
 * </QueryProvider>
 * ```
 *
 * @module @workspace/onesignal/providers
 */

import { clientLogger } from '@workspace/logger/client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import OneSignal from 'react-onesignal'
import type { OneSignalContextValue, OneSignalProviderProps } from '../types'

const logger = clientLogger.child({ provider: 'OneSignal' })

const OneSignalContext = createContext<OneSignalContextValue | null>(null)

/**
 * OneSignal Web Push プロバイダー
 */
export function OneSignalProvider({ children, appId, safariWebId }: OneSignalProviderProps) {
  const [mounted, setMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 初期化
  useEffect(() => {
    setMounted(true)

    if (!appId) {
      logger.warn('App ID is not provided, skipping initialization')
      return
    }

    OneSignal.init({
      appId,
      safari_web_id: safariWebId,
      allowLocalhostAsSecureOrigin: process.env.NODE_ENV === 'development',
    })
      .then(async () => {
        setIsInitialized(true)
        logger.info('Initialized successfully')

        // 購読状態を取得
        try {
          const subscription = await OneSignal.User?.PushSubscription?.optedIn
          setIsSubscribed(Boolean(subscription))
        } catch {
          // 購読状態の取得に失敗しても続行
          logger.warn('Failed to get subscription status')
        }
      })
      .catch((err) => {
        logger.error('Initialization failed', {
          error: err instanceof Error ? err.message : String(err),
        })
        setError(err instanceof Error ? err : new Error(String(err)))
      })
  }, [appId, safariWebId])

  // プッシュ通知許可を促す
  const promptPush = useCallback(async () => {
    if (!isInitialized) {
      logger.warn('SDK not initialized')
      return
    }

    try {
      await OneSignal.Slidedown?.promptPush()

      // 購読状態を更新
      const subscription = await OneSignal.User?.PushSubscription?.optedIn
      setIsSubscribed(Boolean(subscription))
    } catch (err) {
      logger.error('Push prompt failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [isInitialized])

  // ユーザーログイン
  const login = useCallback(
    async (externalUserId: string) => {
      if (!isInitialized) {
        logger.warn('SDK not initialized')
        return
      }

      try {
        await OneSignal.login(externalUserId)
        logger.info('User logged in', { externalUserId })
      } catch (err) {
        logger.error('Login failed', { error: err instanceof Error ? err.message : String(err) })
      }
    },
    [isInitialized]
  )

  // ユーザーログアウト
  const logout = useCallback(async () => {
    if (!isInitialized) {
      logger.warn('SDK not initialized')
      return
    }

    try {
      await OneSignal.logout()
      logger.info('User logged out')
    } catch (err) {
      logger.error('Logout failed', { error: err instanceof Error ? err.message : String(err) })
    }
  }, [isInitialized])

  // SSR 対応: マウント前は null を返す
  if (!mounted) {
    return null
  }

  return (
    <OneSignalContext.Provider
      value={{
        isInitialized,
        isSubscribed,
        error,
        promptPush,
        login,
        logout,
      }}
    >
      {children}
    </OneSignalContext.Provider>
  )
}

/**
 * OneSignal コンテキストフック
 *
 * @throws OneSignalProvider の外で使用された場合
 */
export function useOneSignalContext(): OneSignalContextValue {
  const context = useContext(OneSignalContext)
  if (!context) {
    throw new Error('useOneSignalContext must be used within OneSignalProvider')
  }
  return context
}
