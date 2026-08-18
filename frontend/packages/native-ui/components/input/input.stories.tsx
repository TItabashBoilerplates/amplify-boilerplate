import type { Meta, StoryObj } from '@storybook/react'
import { INPUT_SIZES } from '@workspace/tokens/contract'
import { View } from 'react-native'
import { Input, InputField } from './index'

const SIZES = INPUT_SIZES

/**
 * Mobile Input。
 *
 * `size` の値は `@workspace/tokens/contract` 由来で、Web の `@workspace/ui` の
 * Input と同じ API になっている。
 *
 * **フォントサイズは全サイズで 16px 以上**を保つ（`__tests__/variants.test.ts` が
 * 機械的に守っている）。14px 以下にすると Web ビルドの iOS Safari で
 * フォーカス時に自動ズームするため。
 */
const meta = {
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: [...SIZES] },
    isInvalid: { control: 'boolean' },
    isDisabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <View style={{ width: 280 }}>
      <Input {...args}>
        <InputField placeholder="you@example.com" />
      </Input>
    </View>
  ),
}

export const Sizes: Story = {
  render: () => (
    <View style={{ width: 280, gap: 12 }}>
      {SIZES.map((size) => (
        <Input key={size} size={size}>
          <InputField placeholder={size} />
        </Input>
      ))}
    </View>
  ),
}

export const Invalid: Story = {
  render: () => (
    <View style={{ width: 280 }}>
      <Input isInvalid>
        <InputField placeholder="not-an-email" defaultValue="not-an-email" />
      </Input>
    </View>
  ),
}

export const Disabled: Story = {
  render: () => (
    <View style={{ width: 280 }}>
      <Input isDisabled>
        <InputField placeholder="disabled" editable={false} />
      </Input>
    </View>
  ),
}

export const Filled: Story = {
  render: () => (
    <View style={{ width: 280 }}>
      <Input>
        <InputField defaultValue="user@example.com" />
      </Input>
    </View>
  ),
}
