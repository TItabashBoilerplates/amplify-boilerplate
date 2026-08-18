import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Mail } from 'lucide-react'

/**
 * メールアドレス入力欄
 *
 * 認証系フォーム（ログイン / サインアップ / パスワード再設定 / メール変更）で
 * 使い回す。アイコン付きの `pl-10` レイアウトを各フォームにコピペしないための共有部品。
 *
 * `autoComplete="email"` / `username` はパスワードマネージャに正しく認識させるために必須。
 * ログインフォームでは `username`、それ以外は `email` を渡す。
 *
 * フォントサイズは `@workspace/ui` の `Input` が持つ（モバイル幅で 16px 以上。
 * `.claude/rules/form-controls.md`）。ここでクラスを上書きしないこと。
 */
export function EmailField({
  id,
  name = 'email',
  label,
  defaultValue,
  placeholder,
  disabled,
  autoComplete = 'email',
}: {
  id: string
  name?: string
  label: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  autoComplete?: 'email' | 'username'
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Mail
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          name={name}
          type="email"
          inputMode="email"
          placeholder={placeholder}
          defaultValue={defaultValue}
          required
          disabled={disabled}
          className="pl-10"
          autoComplete={autoComplete}
        />
      </div>
    </div>
  )
}
