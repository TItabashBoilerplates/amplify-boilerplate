import type { Meta, StoryObj } from '@storybook/react'
import { Text, VStack } from '@workspace/native-ui/components'
import { CollapsibleSection } from './CollapsibleSection'

/**
 * 折りたたみセクション。既定は閉じた状態で、タイトル行を押すと開く。
 * 開閉状態はコンポーネント内部の `useState` が持つ。
 */
const meta = {
  component: CollapsibleSection,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
  },
} satisfies Meta<typeof CollapsibleSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'セクションタイトル',
    children: <Text>開いたときに表示される中身です。</Text>,
  },
}

export const WithRichContent: Story = {
  args: {
    title: '複数要素を含むセクション',
    children: (
      <VStack space="sm">
        <Text>1 行目のテキスト</Text>
        <Text className="text-muted-foreground">2 行目（muted）</Text>
        <Text bold>3 行目（bold）</Text>
      </VStack>
    ),
  },
}

/** 並べたときに独立して開閉することの確認 */
export const Multiple: Story = {
  args: { title: '', children: null },
  render: () => (
    <VStack space="md">
      <CollapsibleSection title="セクション A">
        <Text>A の中身</Text>
      </CollapsibleSection>
      <CollapsibleSection title="セクション B">
        <Text>B の中身</Text>
      </CollapsibleSection>
    </VStack>
  ),
}
