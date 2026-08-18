import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { Text } from './index'

const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'] as const

const meta = {
  component: Text,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: SIZES },
    bold: { control: 'boolean' },
    italic: { control: 'boolean' },
    underline: { control: 'boolean' },
    strikeThrough: { control: 'boolean' },
    isTruncated: { control: 'boolean' },
  },
} satisfies Meta<typeof Text>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: 'The quick brown fox jumps over the lazy dog' },
}

export const Bold: Story = {
  args: { ...Default.args, bold: true },
}

export const Muted: Story = {
  render: (args) => <Text {...args} className="text-muted-foreground" />,
  args: Default.args,
}

export const AllSizes: Story = {
  render: () => (
    <View style={{ gap: 8 }}>
      {SIZES.map((size) => (
        <Text key={size} size={size}>
          {size} — The quick brown fox
        </Text>
      ))}
    </View>
  ),
}
