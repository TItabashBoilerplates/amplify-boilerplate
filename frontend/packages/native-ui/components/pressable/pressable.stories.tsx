import type { Meta, StoryObj } from '@storybook/react'
import { Text } from '../text'
import { Pressable } from './index'

const meta = {
  component: Pressable,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Pressable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Pressable {...args} className="rounded-md bg-secondary px-4 py-2">
      <Text>Press me</Text>
    </Pressable>
  ),
}

export const Disabled: Story = {
  render: (args) => (
    <Pressable {...args} disabled className="rounded-md bg-secondary px-4 py-2">
      <Text>Disabled</Text>
    </Pressable>
  ),
}
