import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { View } from 'react-native'
import { AuthField } from './AuthField'

/**
 * ラベル付き入力欄。
 *
 * フォントサイズは `@workspace/native-ui` の `InputField` 側で 16px 以上に
 * 固定されている（Web ビルド時の iOS Safari オートズーム対策）。
 */
const meta = {
  component: AuthField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ width: 320 }}>
        <Story />
      </View>
    ),
  ],
  args: { label: 'メールアドレス', value: '', onChangeText: () => {} },
} satisfies Meta<typeof AuthField>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 実際に入力できる状態。
 *
 * `AuthField` は制御コンポーネントなので、そのまま置くと文字を打っても反映されない
 * （props の `value` が固定のまま）。ストーリー側で state を持つ**コンポーネント**を
 * 定義して包む。render 関数の中で直接 `useState` を呼ぶと
 * react-hooks/rules-of-hooks に引っかかるため、必ず名前付きコンポーネントにする。
 */
function ControlledAuthField(props: React.ComponentProps<typeof AuthField>) {
  const [value, setValue] = useState(props.value)
  return <AuthField {...props} value={value} onChangeText={setValue} />
}

export const Default: Story = {
  render: (args) => <ControlledAuthField {...args} />,
}

export const Filled: Story = { args: { value: 'user@example.com' } }

export const Invalid: Story = { args: { value: 'not-an-email', isInvalid: true } }

export const Disabled: Story = { args: { value: 'user@example.com', isDisabled: true } }

export const Password: Story = {
  args: {
    label: 'パスワード',
    secure: true,
    value: 'Sup3rStr0ng!Pass',
    toggleLabels: { show: '表示', hide: '非表示' },
  },
  render: (args) => <ControlledAuthField {...args} />,
}
