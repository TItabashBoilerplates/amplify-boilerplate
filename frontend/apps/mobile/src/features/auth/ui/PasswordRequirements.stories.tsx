import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'
import { PasswordRequirements } from './PasswordRequirements'

/**
 * パスワード要件のチェックリスト。
 * 判定規則は `@workspace/auth/validation`（Web と共有）が正本。
 */
const meta = {
  component: PasswordRequirements,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <View style={{ width: 320 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof PasswordRequirements>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { password: '' } }

export const Partial: Story = { args: { password: 'Passw0rd' } }

export const Satisfied: Story = { args: { password: 'Sup3rStr0ng!Pass' } }
