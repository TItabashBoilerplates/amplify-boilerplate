import type { Meta, StoryObj } from '@storybook/react'
import { EmailField } from './EmailField'

const meta = {
  component: EmailField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { id: 'email', label: 'Email address', placeholder: 'your.email@example.com' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmailField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true } }

export const Prefilled: Story = { args: { defaultValue: 'user@example.com' } }

/** ログインフォームでは `username` を渡す（パスワードマネージャの認識のため） */
export const ForSignIn: Story = { args: { autoComplete: 'username' } }
