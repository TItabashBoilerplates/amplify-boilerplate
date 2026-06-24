/**
 * OneSignal Mobile 初期化コンポーネント
 *
 * React Native アプリで OneSignal を初期化し、認証状態と連携する。
 *
 * ## 使用方法
 *
 * ```tsx
 * // AppProvider.tsx
 * import { OneSignalInitializer } from './OneSignalInitializer'
 *
 * export function AppProvider({ children }: PropsWithChildren) {
 *   return (
 *     <>
 *       <OneSignalInitializer userId={user?.id} />
 *       {children}
 *     </>
 *   )
 * }
 * ```
 *
 * ## 環境変数
 *
 * - `EXPO_PUBLIC_ONE_SIGNAL_APP_ID` - OneSignal App ID
 */

import { clientLogger } from '@workspace/logger/client'
import { useEffect, useRef } from 'react'
// react-native-onesignal は EAS native build セットアップ時に追加予定。
// インストール前は型・モジュール解決ともに失敗するので両方を抑止する。
// @ts-expect-error - react-native-onesignal は未インストール
import { OneSignal } from 'react-native-onesignal' // eslint-disable-line import/no-unresolved

const logger = clientLogger.child({ provider: 'OneSignal' })

interface OneSignalInitializerProps {
  /**
   * ユーザーID（認証されている場合）
   * null/undefined でログアウト状態
   */
  userId?: string | null
}

/**
 * OneSignal Mobile 初期化コンポーネント
 */
export function OneSignalInitializer({ userId }: OneSignalInitializerProps) {
  const isInitialized = useRef(false)
  const previousUserId = useRef<string | null | undefined>(undefined)

  // SDK 初期化
  useEffect(() => {
    if (isInitialized.current) {
      return
    }

    const appId = process.env.EXPO_PUBLIC_ONE_SIGNAL_APP_ID

    if (!appId) {
      logger.warn('EXPO_PUBLIC_ONE_SIGNAL_APP_ID is not set, skipping initialization')
      return
    }

    try {
      // OneSignal 初期化
      OneSignal.initialize(appId)

      // 通知許可リクエスト
      OneSignal.Notifications.requestPermission(true)

      isInitialized.current = true
      logger.info('Initialized successfully')
    } catch (error) {
      logger.error('Initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  // ユーザー ID 連携
  useEffect(() => {
    if (!isInitialized.current) {
      return
    }

    // 前回と同じユーザー ID の場合はスキップ
    if (previousUserId.current === userId) {
      return
    }

    previousUserId.current = userId

    try {
      if (userId) {
        // ログイン: ユーザー ID を OneSignal に設定
        OneSignal.login(userId)
        logger.info('User logged in', { userId })
      } else {
        // ログアウト: ユーザー ID をクリア
        OneSignal.logout()
        logger.info('User logged out')
      }
    } catch (error) {
      logger.error('User sync failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [userId])

  // レンダリングなし
  return null
}
