import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { StorageImage, type StorageImageProps } from './StorageImage'

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
    // `satisfies Meta` は既定 args から型を絞り込むため、注釈が無いと
    // `(w: number) => string` に固定され、Promise を返すストーリーが型エラーになる
    resolveUrl: ((pixelWidth) =>
      `https://placehold.co/${pixelWidth}x${pixelWidth}/png?text=${pixelWidth}w`) satisfies StorageImageProps['resolveUrl'] as StorageImageProps['resolveUrl'],
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

/**
 * 非公開バケット（既定）の経路。署名は非同期なので `resolveUrl` は Promise を返す。
 * 解決するまではプレースホルダのまま描画され、画面は落ちない。
 */
export const SignedUrlPending: Story = {
  args: { resolveUrl: () => new Promise<string>(() => {}) },
}
