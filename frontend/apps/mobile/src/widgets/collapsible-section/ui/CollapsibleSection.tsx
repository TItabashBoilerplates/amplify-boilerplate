import { Collapsible } from '@workspace/native-ui/components'
import type { PropsWithChildren } from 'react'

interface CollapsibleSectionProps {
  title: string
}

/**
 * 折りたたみ可能なセクション
 * UIコンポーネントのCollapsibleをラップ
 */
export function CollapsibleSection({
  title,
  children,
}: PropsWithChildren<CollapsibleSectionProps>) {
  return <Collapsible title={title}>{children}</Collapsible>
}
