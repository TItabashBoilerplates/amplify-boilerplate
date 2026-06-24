import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useColorScheme } from '@workspace/native-ui/hooks'
import type { PropsWithChildren } from 'react'
import { OneSignalInitializer } from './OneSignalInitializer'

/**
 * アプリケーションプロバイダー
 * テーマ、認証状態、QueryClient などを提供
 *
 * ## OneSignal 連携
 *
 * OneSignalInitializer にユーザー ID を渡すことで、
 * プッシュ通知の送信先とユーザーを紐付けることができます。
 *
 * ```tsx
 * // 認証状態がある場合
 * const { user } = useAuth()
 * <OneSignalInitializer userId={user?.id} />
 * ```
 */
export function AppProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme()

  // TODO: 認証状態を取得して OneSignalInitializer に渡す
  // const { user } = useAuth()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* OneSignal 初期化（認証連携は user?.id を渡す） */}
      <OneSignalInitializer userId={undefined} />
      {children}
    </ThemeProvider>
  )
}
