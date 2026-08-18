import { cn } from '@workspace/ui/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * 認証フォームの結果表示（成功 / エラー共通）
 *
 * **各フォームに同じ `<div className="rounded-lg border p-4 ...">` をコピペしない**
 * ための共有コンポーネント（`.claude/rules/clean-code.md`）。
 * この種のスタイル定数を画面ごとにコピーすると、片方だけ直して不整合が残る。
 *
 * `role="status"` / `aria-live` を付けているのは、送信結果が**視覚以外でも伝わる**
 * ようにするため。スクリーンリーダー利用者はフォーム下部の文字色の変化に気づけない。
 */
export function AuthMessage({
  tone,
  children,
  className,
}: {
  tone: 'success' | 'error'
  children: React.ReactNode
  className?: string
}) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        tone === 'success'
          ? 'border-primary/40 bg-primary/5 text-foreground'
          : 'border-destructive/40 bg-destructive/5 text-destructive',
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
