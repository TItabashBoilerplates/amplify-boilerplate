import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { SignInForm } from './SignInForm'
import { errorResult, pendingResult, successResult } from './storyResults'

/**
 * Mobile のログインフォーム。
 *
 * **ストア審査ではこの画面が使われる。** 審査担当者に渡せるのはメールアドレスと
 * パスワードの組だけなので、OTP のみの構成にすると 2.1(a) でリジェクトされる。
 */
const meta = {
  component: SignInForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ width: 320, padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: { signIn: successResult('signedIn') },
} satisfies Meta<typeof SignInForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = { args: { signIn: pendingResult } }

export const InvalidCredentials: Story = { args: { signIn: errorResult('invalidCredentials') } }

export const EmailNotConfirmed: Story = { args: { signIn: errorResult('emailNotConfirmed') } }

export const RateLimited: Story = { args: { signIn: errorResult('rateLimited') } }

/** 要件強化後の既存ユーザー。エラーだけでは行き止まりなので再設定導線を出す。 */
export const WeakPasswordNeedsReset: Story = {
  args: { signIn: errorResult('weakPassword', true) },
}
