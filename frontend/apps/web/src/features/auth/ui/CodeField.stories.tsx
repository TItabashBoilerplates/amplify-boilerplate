import type { Meta, StoryObj } from '@storybook/react'
import { CodeField } from './CodeField'

const meta = {
  component: CodeField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { label: 'Verification code' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true } }
