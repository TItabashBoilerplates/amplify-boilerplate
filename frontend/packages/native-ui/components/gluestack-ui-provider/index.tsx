import { OverlayProvider } from '@gluestack-ui/core/overlay/creator'
import { ToastProvider } from '@gluestack-ui/core/toast/creator'
import type { PropsWithChildren } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

/**
 * gluestack-ui のオーバーレイ / トーストのポータル、および safe-area inset を提供する。
 *
 * デザイントークン（`--background` / `--primary` ...）はこのプロバイダーではなく
 * `@workspace/tokens` が生成する CSS（mobile は `global.css` 経由）が single source of truth。
 * ライト / ダークの切り替えは `@media (prefers-color-scheme: dark)` で行われるため、
 * ここで色を注入したり color scheme を制御したりはしない。
 *
 * @see `.claude/rules/supabase-config.md` と同じ思想で「設定は 1 箇所」に寄せている
 *
 * `SafeAreaProvider` は React Native / Expo の実質必須インフラ（無いと
 * `useSafeAreaInsets()` / `useSafeAreaFrame()` が例外を投げる）なので最外周に置く。
 * `@workspace/native-ui/components` の `SafeAreaView` はこの Provider の存在を前提にしている。
 * NativeWind v5（react-native-css）で `<SafeAreaView className>` が効かない理由と
 * `SafeAreaView` の正しい使い方は `.claude/skills/gluestack/SKILL.md` 参照。
 */
export function GluestackUIProvider({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <OverlayProvider>
        <ToastProvider>{children}</ToastProvider>
      </OverlayProvider>
    </SafeAreaProvider>
  )
}
