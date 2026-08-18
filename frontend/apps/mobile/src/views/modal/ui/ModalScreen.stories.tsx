import type { Meta, StoryObj } from '@storybook/react'
import { ModalScreen } from './ModalScreen'

/**
 * モーダル画面（全体）。
 *
 * ホームへ戻るリンクは expo-router の `Link`（Storybook ではモック）なので、
 * **押しても遷移しない**。遷移そのものの確認は実機 / Expo で行うこと。
 *
 * ストア掲載用スクショの素材としても使える（詳細と注意点は HomeScreen のストーリー参照）。
 *
 * ⚠️ ここに `globals: { viewport: ... }` を書かないこと（撮影時のテーマ指定が効かなくなる）。
 */
const meta = {
  component: ModalScreen,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ModalScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
