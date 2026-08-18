import type { Meta, StoryObj } from '@storybook/react'
import { HStack } from '@workspace/native-ui/components'
import { UserAvatar } from './UserAvatar'

/**
 * ユーザーアバター。`displayName` の頭文字をフォールバック表示し、
 * `avatarUrl` があれば画像を重ねる。
 */
const meta = {
  component: UserAvatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    avatarUrl: { control: 'text' },
    displayName: { control: 'text' },
  },
} satisfies Meta<typeof UserAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { displayName: 'Taro Yamada', size: 'md' },
}

export const WithImage: Story = {
  args: {
    displayName: 'Taro Yamada',
    size: 'md',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
  },
}

/** displayName が無い場合は `?` になる */
export const NoName: Story = {
  args: { size: 'md' },
}

export const AllSizes: Story = {
  args: { displayName: 'Taro Yamada' },
  render: (args) => (
    <HStack space="md" className="items-center">
      <UserAvatar {...args} size="sm" />
      <UserAvatar {...args} size="md" />
      <UserAvatar {...args} size="lg" />
    </HStack>
  ),
}
