const { getDefaultConfig } = require('expo/metro-config')
const { withNativewind } = require('nativewind/metro')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// NativeWind v5 / react-native-css:
//   - `input` / `configPath` は廃止。CSS は `app/_layout.tsx` で直接 import し、
//     テーマ設定は Tailwind v4 の CSS-first（`@theme`）で行う。
//   - `inlineVariables: false`: CSS 変数をビルド時にインライン展開しない。
//     `@media (prefers-color-scheme: dark)` によるランタイムのトークン切り替えを効かせるために必須。
//   - `globalClassNamePolyfill: true`: React Native プリミティブ（View / Text / ...）に
//     `className` を生やす。Web (shadcn/ui) と同じ書き味を保つために有効化する。
module.exports = withNativewind(config, {
  inlineVariables: false,
  globalClassNamePolyfill: true,
})
