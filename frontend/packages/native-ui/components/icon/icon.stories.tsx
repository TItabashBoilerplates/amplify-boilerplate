import type { Meta, StoryObj } from '@storybook/react'
import { Path } from 'react-native-svg'
import { createIcon, Icon } from './index'

const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'] as const

/**
 * カスタム SVG アイコンの例（`.claude/skills/gluestack-ui-v5` の
 * "Creating Custom Icons with createIcon" パターン）。
 */
const CheckIcon = createIcon({
  viewBox: '0 0 24 24',
  path: <Path d="M20 6L9 17L4 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
})

const meta = {
  component: Icon,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: SIZES },
  },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { as: CheckIcon, size: 'md' },
}

export const AllSizes: Story = {
  render: () => (
    <>
      {SIZES.map((size) => (
        <Icon key={size} as={CheckIcon} size={size} className="m-2" />
      ))}
    </>
  ),
}
