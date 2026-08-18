import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { DeleteAccountForm } from './DeleteAccountForm'
import { errorResult, pendingResult, successResult } from './storyResults'

/**
 * Mobile のアカウント削除。**App Store 5.1.1(v) により必須**。
 * 「サポートへ連絡してください」では要件を満たさない。
 */
const meta = {
  component: DeleteAccountForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ width: 320, padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    currentEmail: 'user@example.com',
    submit: successResult('accountDeleted'),
    signOut: async () => {},
    onDeleted: () => {},
  },
} satisfies Meta<typeof DeleteAccountForm>

export default meta
type Story = StoryObj<typeof meta>

/** 第 1 段階。まずボタンだけを見せる。 */
export const Armed: Story = {}

export const Submitting: Story = { args: { submit: pendingResult } }

export const ConfirmationMismatch: Story = {
  args: { submit: errorResult('deleteConfirmationMismatch') },
}

export const SessionExpired: Story = { args: { submit: errorResult('sessionExpired') } }
