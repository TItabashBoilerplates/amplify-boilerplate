import type { Meta, StoryObj } from '@storybook/react'
import { LocaleSwitcher } from './LocaleSwitcher'

/**
 * ロケール切り替え。押すと `i18n-js` のロケールが切り替わり、
 * 選択中のボタンが `default`、それ以外が `outline` になる。
 *
 * ロケールは i18n インスタンスのモジュールスコープに保持されるため、
 * **このストーリーでの切り替えは同じセッションの他ストーリー（DemoSection 等）にも波及する**。
 */
const meta = {
  component: LocaleSwitcher,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof LocaleSwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
