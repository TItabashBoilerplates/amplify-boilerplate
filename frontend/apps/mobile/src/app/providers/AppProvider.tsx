import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { NativeAuthProvider } from '@workspace/auth/providers/native'
import { useColorScheme } from '@workspace/native-ui/hooks'
import type { PropsWithChildren } from 'react'
// Amplify をクライアント初期化（side-effect import）
import '@/shared/lib/amplify'

/**
 * アプリケーションプロバイダー
 *
 * Amplify の初期化、認証状態（Cognito）、テーマを提供する。
 */
export function AppProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NativeAuthProvider>{children}</NativeAuthProvider>
    </ThemeProvider>
  )
}
