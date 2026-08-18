import type { Meta, StoryObj } from '@storybook/react'
import { HelloWave } from './HelloWave'

/**
 * 手を振るアニメーション（react-native-reanimated）。
 *
 * Storybook は react-native-web 上で動くため、CSS アニメーションとして再生される。
 * ネイティブでの実際の再生タイミング・パフォーマンスは実機で確認すること。
 */
const meta = {
  component: HelloWave,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof HelloWave>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
