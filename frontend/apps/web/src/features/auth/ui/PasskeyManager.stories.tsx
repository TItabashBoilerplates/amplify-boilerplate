import type { Meta, StoryObj } from '@storybook/react'
import { PasskeyManager } from './PasskeyManager'

/**
 * NOTE: Amplify 未設定の Storybook では `listPasskeys` が失敗し、エラー状態が表示される。
 * 一覧・登録・削除の挙動は実環境（`ampx sandbox` で webAuthn を有効化）で確認する。
 */
const meta = {
  component: PasskeyManager,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof PasskeyManager>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <PasskeyManager />
    </div>
  ),
}
