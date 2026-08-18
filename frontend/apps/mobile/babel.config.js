// NativeWind v5 (react-native-css) は import-rewrite 方式のため、
// `nativewind/babel` preset や `jsxImportSource: "nativewind"` は不要
// （v4 以前の JSX 変換方式の名残であり、公式 v5 移行ガイドは明示的に削除を指示している）。
//
// このファイル自体が無いと Metro は babel-preset-expo にフォールバックするが、
// react-native-reanimated 4 / react-native-worklets が要求する worklets babel plugin が
// 一切登録されず、`useAnimatedStyle` 等が動かない（アニメーションが無言で壊れる）。
module.exports = (api) => {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 必ず最後に置くこと（公式ドキュメント指定）
      'react-native-worklets/plugin',
    ],
  }
}
