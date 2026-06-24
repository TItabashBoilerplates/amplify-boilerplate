import type { Meta, StoryObj } from '@storybook/react'
import { Button, ButtonText } from './index'

const meta = {
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    action: {
      control: 'select',
      options: ['primary', 'secondary', 'positive', 'negative'],
    },
    variant: {
      control: 'select',
      options: ['solid', 'outline', 'link'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    isDisabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Button</ButtonText>
    </Button>
  ),
  args: {
    action: 'primary',
    variant: 'solid',
    size: 'md',
  },
}

export const Secondary: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Secondary</ButtonText>
    </Button>
  ),
  args: {
    action: 'secondary',
    variant: 'solid',
    size: 'md',
  },
}

export const Positive: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Success</ButtonText>
    </Button>
  ),
  args: {
    action: 'positive',
    variant: 'solid',
    size: 'md',
  },
}

export const Negative: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Delete</ButtonText>
    </Button>
  ),
  args: {
    action: 'negative',
    variant: 'solid',
    size: 'md',
  },
}

export const Outline: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Outline</ButtonText>
    </Button>
  ),
  args: {
    action: 'primary',
    variant: 'outline',
    size: 'md',
  },
}

export const Link: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Link</ButtonText>
    </Button>
  ),
  args: {
    action: 'primary',
    variant: 'link',
    size: 'md',
  },
}

export const Disabled: Story = {
  render: (args) => (
    <Button {...args}>
      <ButtonText>Disabled</ButtonText>
    </Button>
  ),
  args: {
    action: 'primary',
    variant: 'solid',
    size: 'md',
    isDisabled: true,
  },
}

export const AllActions: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      <Button action="primary">
        <ButtonText>Primary</ButtonText>
      </Button>
      <Button action="secondary">
        <ButtonText>Secondary</ButtonText>
      </Button>
      <Button action="positive">
        <ButtonText>Positive</ButtonText>
      </Button>
      <Button action="negative">
        <ButtonText>Negative</ButtonText>
      </Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <Button size="xs">
        <ButtonText>XS</ButtonText>
      </Button>
      <Button size="sm">
        <ButtonText>SM</ButtonText>
      </Button>
      <Button size="md">
        <ButtonText>MD</ButtonText>
      </Button>
      <Button size="lg">
        <ButtonText>LG</ButtonText>
      </Button>
      <Button size="xl">
        <ButtonText>XL</ButtonText>
      </Button>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px' }}>
      <Button variant="solid">
        <ButtonText>Solid</ButtonText>
      </Button>
      <Button variant="outline">
        <ButtonText>Outline</ButtonText>
      </Button>
      <Button variant="link">
        <ButtonText>Link</ButtonText>
      </Button>
    </div>
  ),
}
