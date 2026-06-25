import type { Meta, StoryObj } from '@storybook/react'
import { SocialSignInButtons } from './SocialSignInButtons'

const meta = {
  component: SocialSignInButtons,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof SocialSignInButtons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { providers: ['Google', 'Apple'] },
}

export const AllProviders: Story = {
  args: { providers: ['Google', 'Apple', 'Facebook', 'Amazon'] },
}

export const SingleProvider: Story = {
  args: { providers: ['Google'] },
}
