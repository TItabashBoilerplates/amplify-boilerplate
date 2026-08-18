import type { Meta, StoryObj } from '@storybook/react'
import { DeleteAccountForm } from './DeleteAccountForm'

/**
 * アカウント削除フォーム
 *
 * 誤タップ防止のため 2 段階（警告 → メールアドレスの再入力）にしている。
 * 初期状態は警告のみで、`Delete account` を押すと確認フォームが出る。
 */
const meta = {
  component: DeleteAccountForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { email: 'user@example.com' },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeleteAccountForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
