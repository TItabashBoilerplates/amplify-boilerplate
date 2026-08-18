import type { Meta, StoryObj } from '@storybook/react'
import { PasswordLoginForm } from './PasswordLoginForm'

/**
 * パスワードログインフォーム
 *
 * 実際の送信は Cognito を叩くため、Storybook では**初期表示**の確認に用いる
 * （送信後の状態は下の各ストーリーで再現する対象ではない）。
 */
const meta = {
  component: PasswordLoginForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordLoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
