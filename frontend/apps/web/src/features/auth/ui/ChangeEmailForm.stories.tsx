import type { Meta, StoryObj } from '@storybook/react'
import { ChangeEmailForm } from './ChangeEmailForm'

const meta = {
  component: ChangeEmailForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { currentEmail: 'user@example.com' },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChangeEmailForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongEmail: Story = {
  args: { currentEmail: 'a.very.long.email.address+tag@subdomain.example.co.jp' },
}
