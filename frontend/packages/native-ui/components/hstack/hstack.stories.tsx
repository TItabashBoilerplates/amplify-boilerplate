import type { Meta, StoryObj } from '@storybook/react'
import { Box } from '../box'
import { Text } from '../text'
import { HStack } from './index'

const SPACES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] as const

const meta = {
  component: HStack,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    space: { control: 'select', options: SPACES },
    reversed: { control: 'boolean' },
  },
} satisfies Meta<typeof HStack>

export default meta
type Story = StoryObj<typeof meta>

const Chip = ({ label }: { label: string }) => (
  <Box className="rounded-md bg-primary px-3 py-2">
    <Text className="text-primary-foreground">{label}</Text>
  </Box>
)

export const Default: Story = {
  render: (args) => (
    <HStack {...args}>
      <Chip label="Item 1" />
      <Chip label="Item 2" />
      <Chip label="Item 3" />
    </HStack>
  ),
  args: { space: 'md' },
}
