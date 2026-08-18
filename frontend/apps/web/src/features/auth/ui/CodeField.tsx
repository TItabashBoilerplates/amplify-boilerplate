import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { KeyRound } from 'lucide-react'

/**
 * 確認コード（6 桁）入力欄
 *
 * Cognito の確認コードはサインアップ確認 / パスワード再設定 / メール変更 / Email OTP の
 * **4 か所**で使う。同じ入力欄を 4 回コピペしないための共有部品。
 *
 * `autoComplete="one-time-code"` は **必須**。これが無いと iOS / Android の
 * SMS・メール OTP 自動入力が働かず、ユーザーはメールアプリとの往復を強いられる
 * （`.claude/rules/mobile-uiux.md`）。
 */
export function CodeField({
  label,
  name = 'code',
  disabled,
}: {
  label: string
  name?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <KeyRound
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={name}
          name={name}
          type="text"
          required
          disabled={disabled}
          className="pl-10 text-center text-2xl tracking-widest"
          maxLength={8}
          pattern="[0-9]{6,8}"
          autoComplete="one-time-code"
          inputMode="numeric"
        />
      </div>
    </div>
  )
}
