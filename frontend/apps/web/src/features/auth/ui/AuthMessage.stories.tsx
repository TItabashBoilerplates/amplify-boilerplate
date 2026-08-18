import type { Meta, StoryObj } from '@storybook/react'
import { AuthMessage } from './AuthMessage'

const meta = {
  component: AuthMessage,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthMessage>

export default meta
type Story = StoryObj<typeof meta>

export const SuccessTone: Story = {
  args: { tone: 'success', children: 'Your password has been updated.' },
}

export const ErrorTone: Story = {
  args: { tone: 'error', children: 'Incorrect email address or password.' },
}

/** 折り返しが崩れないことを確認する（エラー文は長くなりがち） */
export const LongText: Story = {
  args: {
    tone: 'error',
    children:
      'Too many attempts. Wait a few minutes and try again. If the problem persists, contact support so we can look into it for you.',
  },
}
