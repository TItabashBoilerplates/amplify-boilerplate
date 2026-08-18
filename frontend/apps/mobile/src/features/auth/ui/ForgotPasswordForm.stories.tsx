import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { errorResult, pendingResult, successResult } from './storyResults'

/**
 * Mobile のパスワード再設定（6 桁コード方式）。
 *
 * ディープリンクではなくコードを使うのは、スパム対策によるリンクの事前消費が
 * Supabase 公式の Limitations に挙がっている既知問題で、公式の回避策が
 * `{{ .Token }}` の OTP 方式だから。
 */
const meta = {
  component: ForgotPasswordForm,
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
    requestCode: successResult('passwordResetCodeSent'),
    confirmReset: successResult('passwordUpdated'),
  },
} satisfies Meta<typeof ForgotPasswordForm>

export default meta
type Story = StoryObj<typeof meta>

/** 第 1 段階: メールアドレスを入力してコードを送る */
export const RequestStep: Story = {}

export const RequestSubmitting: Story = { args: { requestCode: pendingResult } }

/** 連打対策。レート制限だけは事実として伝える。 */
export const RateLimited: Story = { args: { requestCode: errorResult('rateLimited') } }

export const InvalidEmail: Story = { args: { requestCode: errorResult('emailInvalidFormat') } }

/** 第 2 段階でコードが誤っている場合（送信後の画面はコード入力から始まる） */
export const CodeExpired: Story = { args: { confirmReset: errorResult('codeExpired') } }
