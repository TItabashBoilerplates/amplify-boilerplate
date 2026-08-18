import { type Edge, useSafeAreaInsets } from 'react-native-safe-area-context'

import type { BoxProps } from '../box'
import { Box } from '../box'
import { DEFAULT_SAFE_AREA_EDGES, resolveSafeAreaPadding } from './style'

type SafeAreaViewProps = BoxProps & {
  edges?: readonly Edge[]
}

/**
 * `react-native-safe-area-context` の `SafeAreaView` は **`className` に対応しない**。
 *
 * NativeWind v5 の実体 `react-native-css` は `react-native-safe-area-context` の import を
 * 横取りするが、`SafeAreaProvider` だけをラップし `SafeAreaView` はそのまま re-export する
 * （inset を CSS カスタムプロパティとして注入するだけで `cssInterop` は適用しない）。
 * `SafeAreaView` はネイティブホストコンポーネントで、`className` prop は
 * `SafeAreaViewProps extends ViewProps`（`react-native` の型）経由で**型としては通ってしまう**
 * ため、TypeScript も lint もエラーを出さないまま実行時にだけ無視される。
 *
 * このコンポーネントは `useSafeAreaInsets()`（`GluestackUIProvider` の `SafeAreaProvider` が
 * 供給する）で実際の inset を取得し、`Box` に `style` として適用することで
 * `className="flex-1 bg-background"` のような gluestack の書き味を保ったまま
 * 確実に安全域パディングを効かせる。詳細は `.claude/skills/gluestack/SKILL.md` 参照。
 *
 * React 19 では ref は通常の prop として渡せるため forwardRef は使わない。
 * @see .claude/skills/upgrading-expo/references/react-19.md
 */
function SafeAreaView({ style, edges = DEFAULT_SAFE_AREA_EDGES, ...props }: SafeAreaViewProps) {
  const insets = useSafeAreaInsets()
  return <Box style={[resolveSafeAreaPadding(insets, edges), style]} {...props} />
}
SafeAreaView.displayName = 'SafeAreaView'

export { DEFAULT_SAFE_AREA_EDGES, resolveSafeAreaPadding } from './style'
export type { SafeAreaViewProps }
export { SafeAreaView }
