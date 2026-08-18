/**
 * Native の JS 側から使うテーマ値。
 *
 * 色の正本は `@workspace/tokens`（OKLCh）。ここではそれを hex に解決して
 * **hex しか受け取れない API**（react-navigation の theme、`tabBarActiveTintColor` など）
 * に渡せる形にしているだけ。ここで独自のパレットを定義してはいけない。
 *
 * className が使える場所では `bg-background` / `text-foreground` のような
 * セマンティックユーティリティを使うこと（Web / Desktop と完全に共通）。
 */

import { resolvedColors } from '@workspace/tokens/oklch'
import { Platform } from 'react-native'

export const Colors = {
  light: {
    text: resolvedColors.light.foreground,
    background: resolvedColors.light.background,
    tint: resolvedColors.light.primary,
    icon: resolvedColors.light.mutedForeground,
    tabIconDefault: resolvedColors.light.mutedForeground,
    tabIconSelected: resolvedColors.light.primary,
    border: resolvedColors.light.border,
    card: resolvedColors.light.card,
  },
  dark: {
    text: resolvedColors.dark.foreground,
    background: resolvedColors.dark.background,
    tint: resolvedColors.dark.primary,
    icon: resolvedColors.dark.mutedForeground,
    tabIconDefault: resolvedColors.dark.mutedForeground,
    tabIconSelected: resolvedColors.dark.primary,
    border: resolvedColors.dark.border,
    card: resolvedColors.dark.card,
  },
} as const

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})
