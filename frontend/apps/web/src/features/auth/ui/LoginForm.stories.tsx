import type { Meta, StoryObj } from '@storybook/react'
import { LoginForm } from './LoginForm'

/**
 * ワンタイムコードのログインフォーム
 *
 * 実際の送信は Cognito を叩くため、Storybook では**初期表示**の確認に用いる
 * （送信後の状態は下の各ストーリーで再現する対象ではない）。
 */
const meta = {
  component: LoginForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
