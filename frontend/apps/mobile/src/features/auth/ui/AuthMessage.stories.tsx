import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { AuthMessage } from './AuthMessage'

/** 結果表示の共有部品。`accessibilityLiveRegion` で視覚以外にも結果を伝える。 */
const meta = {
  component: AuthMessage,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ width: 320 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AuthMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: { tone: 'success', message: 'パスワードを更新しました。' },
}

export const ErrorTone: Story = {
  args: { tone: 'error', message: 'メールアドレスまたはパスワードが違います。' },
}

export const LongText: Story = {
  args: {
    tone: 'success',
    message:
      '確認メールを送信しました。現在のアドレスと新しいアドレスの両方をご確認ください。両方で確認が完了するまでメールアドレスは変更されません。',
  },
}
