import type { Meta, StoryObj } from '@storybook/react'
import { ExploreScreen } from './ExploreScreen'

/**
 * Explore 画面（全体）。折りたたみセクションと外部リンクを含む。
 *
 * ストア掲載用スクショの素材としても使える（詳細と注意点は HomeScreen のストーリー参照）。
 *
 * ⚠️ ここに `globals: { viewport: ... }` を書かないこと（撮影時のテーマ指定が効かなくなる）。
 */
const meta = {
  component: ExploreScreen,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ExploreScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
