import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { StorageImage } from './StorageImage'

/**
 * S3 の画像を表示サイズに合わせて配信するコンポーネント（Mobile）。
 *
 * `resolveUrl` に**丸めた実ピクセル幅**が渡ってくる。ストーリーでは S3 を叩けないので
 * 受け取った幅を使ってプレースホルダ画像を返し、丸めが効いていることを確認する。
 */
const meta = {
  component: StorageImage,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    resolveUrl: (pixelWidth: number) =>
      `https://placehold.co/${pixelWidth}x${pixelWidth}/png?text=${pixelWidth}w`,
    width: 96,
    height: 96,
    accessibilityLabel: 'Placeholder',
  },
} satisfies Meta<typeof StorageImage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 40dp × DPR を段に丸めた幅が要求される */
export const SmallAvatar: Story = { args: { width: 40, height: 40 } }

export const WideAspect: Story = {
  args: {
    resolveUrl: (pixelWidth: number) =>
      `https://placehold.co/${pixelWidth}x${Math.round(pixelWidth * 0.5625)}/png?text=${pixelWidth}w`,
    width: 320,
    height: 180,
  },
}

export const ContainFit: Story = { args: { contentFit: 'contain' } }
