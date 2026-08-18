import { ThemeProvider } from '@react-navigation/native'
import { GluestackUIProvider } from '@workspace/native-ui/components'
import { NavigationDarkTheme, NavigationLightTheme } from '@workspace/native-ui/constants'
import { useColorScheme } from '@workspace/native-ui/hooks'
import type { PropsWithChildren } from 'react'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import '@/shared/lib/amplify'

/**
 * アプリケーションプロバイダー
 *
 * `KeyboardProvider` は**アプリのルートに 1 つだけ**置く。無いと
 * `KeyboardAwareScrollView` 等が**エラーも出さずに何もしない**
 * （`.claude/rules/mobile-uiux.md` §1.2）。
 *
 * `@/shared/lib/amplify` の副作用 import で `Amplify.configure` を 1 か所に固定する
 * （feature の中で configure しない。`.claude/rules/auth.md` §3.7）。
 */
export function AppProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme()

  return (
    <KeyboardProvider>
      {/* ナビゲーションの配色も @workspace/tokens 由来（Web と共通） */}
      <ThemeProvider value={colorScheme === 'dark' ? NavigationDarkTheme : NavigationLightTheme}>
        {/* gluestack-ui のオーバーレイ / トーストのポータル */}
        <GluestackUIProvider>{children}</GluestackUIProvider>
      </ThemeProvider>
    </KeyboardProvider>
  )
}
