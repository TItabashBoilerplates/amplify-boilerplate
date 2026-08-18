import type { Meta, StoryObj } from '@storybook/react'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { Text } from '../text'
import { SafeAreaView } from './index'

/**
 * Storybook（Web）には実機の inset が無いので、iPhone 相当の値を
 * `SafeAreaProvider` の `initialMetrics` で固定して見た目を確認できるようにする。
 */
const FALLBACK_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

const meta = {
  component: SafeAreaView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? FALLBACK_METRICS}>
        <Story />
      </SafeAreaProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof SafeAreaView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <SafeAreaView {...args} className="flex-1 bg-background">
      <Text>Content padded away from the notch / home indicator</Text>
    </SafeAreaView>
  ),
}

export const TopOnly: Story = {
  render: (args) => (
    <SafeAreaView {...args} edges={['top']} className="flex-1 bg-card">
      <Text>Only the top inset is applied</Text>
    </SafeAreaView>
  ),
}
