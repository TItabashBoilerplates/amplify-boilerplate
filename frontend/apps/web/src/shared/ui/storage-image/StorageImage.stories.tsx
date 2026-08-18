import type { Meta, StoryObj } from '@storybook/react'
import { StorageImage } from './StorageImage'

/**
 * S3 の画像を表示サイズに合わせて配信するコンポーネント（Web）。
 *
 * ストーリーでは実際の S3 を叩けないので、ローカルの静的画像で
 * **幅の丸め・アスペクト比の維持・署名 URL 経路**の見た目を確認する。
 */
const meta = {
  component: StorageImage,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    src: '/globe.svg',
    alt: 'Globe',
    width: 96,
    height: 96,
  },
} satisfies Meta<typeof StorageImage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 40px 要求は段に丸められて 48px の画像を要求する */
export const SnappedWidth: Story = { args: { width: 40, height: 40 } }

/** 縦横比は width/height の比から維持される */
export const WideAspect: Story = {
  args: { src: '/window.svg', alt: 'Window', width: 320, height: 180 },
}

/**
 * 非公開バケットの経路。**署名はサーバー側**で行い URL だけを渡す。
 * 一覧に大量に並べないこと（毎回 URL が変わりキャッシュが効かない）。
 */
export const SignedUrl: Story = {
  args: { src: undefined, signedUrl: '/file.svg', alt: 'Private file', width: 96, height: 96 },
}
