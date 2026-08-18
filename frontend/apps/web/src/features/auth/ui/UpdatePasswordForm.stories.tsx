import type { Meta, StoryObj } from '@storybook/react'
import { UpdatePasswordForm } from './UpdatePasswordForm'

const meta = {
  component: UpdatePasswordForm,
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
} satisfies Meta<typeof UpdatePasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
