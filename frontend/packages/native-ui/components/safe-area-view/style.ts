import type { Edge, EdgeInsets } from 'react-native-safe-area-context'

/**
 * `react-native-safe-area-context` の `SafeAreaView` と同じ既定値
 * （4 辺すべてに inset を適用する）。
 */
export const DEFAULT_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left']

/**
 * insets と対象辺から padding style を計算する純粋関数。
 *
 * React Native に依存しないので Vitest からそのままテストできる
 * （`variants.ts` を本体から切り出しているのと同じ理由）。
 */
export function resolveSafeAreaPadding(insets: EdgeInsets, edges: readonly Edge[]) {
  return {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
  }
}
