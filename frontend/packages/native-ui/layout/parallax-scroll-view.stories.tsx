import type { Meta, StoryObj } from '@storybook/react'
import { Box, Text, VStack } from '../components'
import ParallaxScrollView from './parallax-scroll-view'

/**
 * ヘッダー画像がスクロールに追従して拡大・移動するスクロールビュー。
 *
 * `react-native-reanimated` の `useScrollOffset` / `useAnimatedStyle` を使うため、
 * **スクロールしないと挙動が確認できない**（`layout: 'fullscreen'` にしてある）。
 */
const ROWS = Array.from({ length: 20 }, (_, i) => `行 ${i + 1}`)

const meta = {
  component: ParallaxScrollView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ParallaxScrollView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    headerImage: <Box className="h-full w-full bg-primary" />,
    children: (
      <VStack space="md">
        {ROWS.map((row) => (
          <Text key={row}>スクロールしてヘッダーの視差効果を確認 — {row}</Text>
        ))}
      </VStack>
    ),
  },
}
