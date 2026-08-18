import type { Meta, StoryObj } from '@storybook/react'
import { DemoSection } from './DemoSection'

/**
 * NativeWind + gluestack-ui のデモセクション。
 *
 * 文言は `i18n-js`（`@/shared/config/i18n`）から取得する。ロケールは
 * `expo-localization` がブラウザの言語設定から解決するため、Storybook 上の表示言語は
 * **ブラウザの設定に依存**する。明示的に切り替えたい場合は LocaleSwitcher のストーリーで
 * 変更してからこのストーリーを開くこと。
 */
const meta = {
  component: DemoSection,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof DemoSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
