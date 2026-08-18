import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { ChangeEmailForm } from './ChangeEmailForm'
import { errorResult, pendingResult, successResult } from './storyResults'

/**
 * 設定画面のメールアドレス再設定。認証方式を問わず必須の導線。
 * 旧・新の両方で確認するまで変わらない旨を画面に明示している。
 */
const meta = {
  component: ChangeEmailForm,
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
    submit: successResult('emailChangeRequested'),
    confirm: successResult('emailChanged'),
  },
} satisfies Meta<typeof ChangeEmailForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = { args: { submit: pendingResult } }

export const ConfirmationSent: Story = { args: { submit: successResult('emailChangeRequested') } }

export const InvalidEmail: Story = { args: { submit: errorResult('emailInvalidFormat') } }

/** 長いアドレスで折り返しが崩れないこと。 */
export const LongCurrentEmail: Story = {
  args: { currentEmail: 'very.long.email.address.for.layout@subdomain.example.co.jp' },
}
