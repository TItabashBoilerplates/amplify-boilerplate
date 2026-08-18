import type { Meta, StoryObj } from '@storybook/react'
import { Text } from '../text'
import { Box } from './index'

/**
 * Mobile Box。汎用レイアウトプリミティブ（`View` のセマンティックラッパー）。
 */
const meta = {
  component: Box,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Box>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Box {...args} className="rounded-lg border border-border bg-card p-4">
      <Text>Box content</Text>
    </Box>
  ),
}

export const Nested: Story = {
  render: () => (
    <Box className="gap-2 rounded-lg bg-muted p-4">
      <Box className="rounded-md bg-primary p-3">
        <Text className="text-primary-foreground">Nested box</Text>
      </Box>
    </Box>
  ),
}
