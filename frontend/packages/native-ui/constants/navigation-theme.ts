/**
 * react-navigation のテーマを共有デザイントークンから組み立てる。
 *
 * react-navigation は hex 等の色値しか受け取れないため、`Colors`（= `@workspace/tokens`
 * を hex に解決したもの）を流し込む。これで画面の地の色・ヘッダー・境界線が
 * Web / Desktop と同じトークンに揃う。
 */

import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native'
import { Colors } from './theme'

export const NavigationLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
  },
}

export const NavigationDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
}
