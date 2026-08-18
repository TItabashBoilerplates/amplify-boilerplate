import type { Meta, StoryObj } from '@storybook/react'
import { ExternalLink } from './ExternalLink'

/**
 * 外部リンク。
 *
 * ネイティブでは `expo-web-browser` のアプリ内ブラウザで開き、Web では通常の
 * `target="_blank"` リンクになる（`process.env.EXPO_OS` で分岐）。
 * Storybook は Web なので、**ここで確認できるのは Web 側の挙動のみ**。
 * アプリ内ブラウザの見た目は実機で確認すること。
 */
const meta = {
  component: ExternalLink,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    href: { control: 'text' },
  },
} satisfies Meta<typeof ExternalLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    href: 'https://expo.dev',
    children: 'expo.dev を開く',
  },
}
