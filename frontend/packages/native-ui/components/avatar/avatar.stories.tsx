import type { Meta, StoryObj } from '@storybook/react'
import { Avatar, AvatarFallbackText, AvatarImage } from './index'

const meta = {
  component: Avatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallbackText>Jane Doe</AvatarFallbackText>
    </Avatar>
  ),
}

export const WithImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallbackText>Jane Doe</AvatarFallbackText>
      <AvatarImage source={{ uri: 'https://i.pravatar.cc/150?img=1' }} />
    </Avatar>
  ),
}

export const Small: Story = {
  render: (args) => (
    <Avatar {...args} className="h-8 w-8">
      <AvatarFallbackText>Jane Doe</AvatarFallbackText>
    </Avatar>
  ),
}
