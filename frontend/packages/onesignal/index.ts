/**
 * OneSignal Frontend パッケージ
 *
 * Web Push / Mobile Push の統合パッケージ。
 *
 * ## Web (Next.js)
 *
 * ```tsx
 * import { OneSignalProvider, useOneSignalAuth } from '@workspace/onesignal'
 *
 * // layout.tsx
 * <OneSignalProvider appId={process.env.NEXT_PUBLIC_ONE_SIGNAL_APP_ID!}>
 *   {children}
 * </OneSignalProvider>
 *
 * // AuthenticatedLayout.tsx
 * function AuthenticatedLayout({ user, children }) {
 *   useOneSignalAuth(user?.id)
 *   return <>{children}</>
 * }
 * ```
 *
 * ## Mobile (Expo)
 *
 * Mobile では react-native-onesignal を直接使用。
 * 初期化は app/_layout.tsx で行う。
 *
 * @module @workspace/onesignal
 */

// Hooks
export { useOneSignalAuth, useOneSignalSubscription } from './hooks'

// Providers
export { OneSignalProvider, useOneSignalContext } from './providers'
// Types
export type {
  OneSignalContextValue,
  OneSignalInitOptions,
  OneSignalProviderProps,
} from './types'
