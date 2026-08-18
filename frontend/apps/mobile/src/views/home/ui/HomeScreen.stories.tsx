import type { Meta, StoryObj } from '@storybook/react'
import { HomeScreen } from './HomeScreen'

/**
 * ホーム画面（全体）。
 *
 * 画面まるごとを載せているのは **UI/UX デバッグ用**（レイアウト崩れ・トークン適用・
 * ダーク/ライトの確認）。ツールバーの Viewport で実機相当の画面幅に切り替えられる。
 *
 * ストア掲載用スクショの素材としても使える（`screenshots-storybook`）。
 * ただし react-native-web の描画なので、**ネイティブ部品・shadow/elevation・
 * ステータスバー・セーフエリアが写る画面は実機と食い違う**。
 * `screenshots-storybook` はそれらを検出して警告するので、
 * 警告が出た画面は `screenshots-mobile`（simulator/emulator の実描画）で撮り直すこと。
 *
 * ⚠️ ここに `globals: { viewport: ... }` を書かないこと。
 *    ストーリー側の globals は URL の globals を上書きするため、撮影スクリプトからの
 *    テーマ指定（`?globals=theme:dark`）が効かなくなる。画面幅はツールバーで切り替える。
 */
const meta = {
  component: HomeScreen,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof HomeScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
