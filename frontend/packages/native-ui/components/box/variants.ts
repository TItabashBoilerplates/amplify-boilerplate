import { tva } from '@gluestack-ui/utils/nativewind-utils'

/**
 * Mobile Box のクラス定義。
 *
 * gluestack-ui v5 公式の Box と同じ構造リセット（`flex-col` ベース）のみを持つ。
 * 色を持たないレイアウトプリミティブなので `@workspace/tokens/contract` との
 * 契約は不要（Web 側に対応コンポーネントが無く、共有すべき API が無いため）。
 */
export const boxStyle = tva({
  base: 'flex-col',
})
