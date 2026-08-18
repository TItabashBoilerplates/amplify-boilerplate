import type { Meta, StoryObj } from '@storybook/react'
import { PasswordField } from './PasswordField'

const meta = {
  component: PasswordField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { name: 'password', label: 'Password', autoComplete: 'current-password' as const },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true } }

/** 新規パスワード入力欄。要件チェックリストを出して「何が足りないか」を伝える */
export const WithRequirements: Story = {
  args: { autoComplete: 'new-password', label: 'New password', showRequirements: true },
}

export const RequirementsPartiallyMet: Story = {
  args: {
    autoComplete: 'new-password',
    label: 'New password',
    showRequirements: true,
    value: 'lowercase1',
  },
}

export const RequirementsAllMet: Story = {
  args: {
    autoComplete: 'new-password',
    label: 'New password',
    showRequirements: true,
    value: 'Str0ng-Passw0rd!',
  },
}
