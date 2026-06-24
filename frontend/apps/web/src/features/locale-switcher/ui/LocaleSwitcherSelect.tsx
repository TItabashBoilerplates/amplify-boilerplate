'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { useParams } from 'next/navigation'
import { type ReactNode, useTransition } from 'react'
import { usePathname, useRouter } from '@/shared/lib/i18n'

interface LocaleSwitcherSelectProps {
  defaultValue: string
  label: string
  children: ReactNode
}

/**
 * 言語切り替えセレクトコンポーネント（Client Component）
 *
 * shadcn/ui Selectを使用した言語切り替えUI
 * useTransitionでローディング状態を管理
 *
 * @param defaultValue - 現在の言語
 * @param label - アクセシビリティ用ラベル
 * @param children - Select options（Server Componentから渡される）
 */
export default function LocaleSwitcherSelect({
  defaultValue,
  label,
  children,
}: LocaleSwitcherSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [isPending, startTransition] = useTransition()

  function onSelectChange(nextLocale: string) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        { pathname, params },
        { locale: nextLocale }
      )
    })
  }

  // childrenから<option>要素を抽出してSelectItemに変換
  const options = children as React.ReactElement<{ value: string; children: ReactNode }>[]
  const selectItems = options.map((option) => (
    <SelectItem key={option.key ?? option.props.value} value={option.props.value}>
      {option.props.children}
    </SelectItem>
  ))

  return (
    <Select defaultValue={defaultValue} onValueChange={onSelectChange} disabled={isPending}>
      <SelectTrigger className="w-[180px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{selectItems}</SelectContent>
    </Select>
  )
}
