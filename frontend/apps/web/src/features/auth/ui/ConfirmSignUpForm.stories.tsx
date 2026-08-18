import type { Meta, StoryObj } from '@storybook/react'
import { ConfirmSignUpForm } from './ConfirmSignUpForm'

const meta = {
  component: ConfirmSignUpForm,
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
} satisfies Meta<typeof ConfirmSignUpForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 長いアドレスでレイアウトが崩れないことを確認する */
export const LongEmail: Story = {
  args: { email: 'a.very.long.email.address+tag@subdomain.example.co.jp' },
}
