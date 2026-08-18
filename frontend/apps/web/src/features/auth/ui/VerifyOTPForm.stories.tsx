import type { Meta, StoryObj } from '@storybook/react'
import { VerifyOTPForm } from './VerifyOTPForm'

const meta = {
  component: VerifyOTPForm,
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
} satisfies Meta<typeof VerifyOTPForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongEmail: Story = {
  args: { email: 'a.very.long.email.address+tag@subdomain.example.co.jp' },
}
