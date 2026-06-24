'use client'

/**
 * OneSignal 購読状態管理フック
 *
 * プッシュ通知の購読状態を取得し、購読を促すための機能を提供する。
 *
 * @module @workspace/onesignal/hooks
 */

import { useOneSignalContext } from '../providers/OneSignalProvider'

/**
 * 購読状態と操作を取得
 *
 * @returns 購読状態とプロンプト表示関数
 *
 * @example
 * ```tsx
 * import { useOneSignalSubscription } from '@workspace/onesignal/hooks'
 *
 * function NotificationSettings() {
 *   const { isSubscribed, promptPush } = useOneSignalSubscription()
 *
 *   if (isSubscribed) {
 *     return <p>プッシュ通知は有効です</p>
 *   }
 *
 *   return (
 *     <button onClick={promptPush}>
 *       プッシュ通知を有効にする
 *     </button>
 *   )
 * }
 * ```
 */
export function useOneSignalSubscription() {
  const { isInitialized, isSubscribed, promptPush } = useOneSignalContext()

  return {
    /**
     * SDK 初期化完了状態
     */
    isReady: isInitialized,

    /**
     * プッシュ通知購読状態
     */
    isSubscribed,

    /**
     * プッシュ通知の許可を促す
     */
    promptPush,
  }
}
