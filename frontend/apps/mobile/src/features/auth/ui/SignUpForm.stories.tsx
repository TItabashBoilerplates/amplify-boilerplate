import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { SignUpForm } from './SignUpForm'
import { errorResult, pendingResult, successResult } from './storyResults'

/** Mobile のサインアップ。成功時は確認メールの案内に差し替わる。 */
const meta = {
  component: SignUpForm,
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
    signUp: successResult('signUpConfirmationSent'),
    confirmSignUp: successResult('signUpConfirmed'),
    resendConfirmation: successResult('signUpConfirmationSent'),
  },
} satisfies Meta<typeof SignUpForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = { args: { signUp: pendingResult } }

export const PasswordTooWeak: Story = { args: { signUp: errorResult('passwordTooWeak') } }

export const PasswordMismatch: Story = { args: { signUp: errorResult('passwordMismatch') } }

export const EmailInvalid: Story = { args: { signUp: errorResult('emailInvalidFormat') } }
