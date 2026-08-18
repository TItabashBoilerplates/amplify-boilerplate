import * as Haptics from 'expo-haptics'
// expo-router 57 は bottom-tabs / elements を内製化しており、`@react-navigation/*` の
// 同名パッケージとは型が異なる（`pressColor` が `ColorValue` か `string` か等）。
// Tabs に渡すボタンなので、expo-router 側の型・実装で揃える。
import { PlatformPressable } from 'expo-router/react-navigation'
import type { BottomTabBarButtonProps } from 'expo-router/tabs'

/**
 * ハプティックフィードバック付きタブボタン
 * iOSでタブ押下時に軽いフィードバックを提供
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
        props.onPressIn?.(ev)
      }}
    />
  )
}
