import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { ChangePasswordForm } from './ChangePasswordForm'
import { errorResult, pendingResult, successResult } from './storyResults'

/**
 * 設定画面のパスワード変更。
 * 現在のパスワードは `updateUser({ current_password, password })` で検証する。
 */
const meta = {
  component: ChangePasswordForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ width: 320, padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: { submit: successResult('passwordUpdated') },
} satisfies Meta<typeof ChangePasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = { args: { submit: pendingResult } }

export const Updated: Story = { args: { submit: successResult('passwordUpdated') } }

export const WrongCurrentPassword: Story = { args: { submit: errorResult('invalidCredentials') } }

export const SamePassword: Story = { args: { submit: errorResult('samePassword') } }
