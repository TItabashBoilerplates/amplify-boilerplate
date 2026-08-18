'use client'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { deleteAccount, signOut } from '../api'
import type { AuthResult } from '../model/types'
import { AuthMessage } from './AuthMessage'

/**
 * アカウント削除フォーム（設定画面）
 *
 * **アカウント作成ができるアプリでは、アプリ内の削除導線が App Store 5.1.1(v) で必須**
 * （`.claude/rules/store-review.md` §4）。
 *
 * 誤タップで消えないよう、**メールアドレスの再入力**を確認手順として要求する
 * （2 段階にすることで「削除」ボタンの隣を押しただけで消える事故を防ぐ）。
 *
 * ⚠️ `deleteUser()` は Cognito のユーザーだけを消す。Amplify Data の関連データを持つ
 * プロダクトでは、削除フローの一部としてそれらも消すこと（`.claude/rules/auth.md` §3.5）。
 */
export function DeleteAccountForm({ email, className }: { email: string; className?: string }) {
  const t = useTranslations('Auth')
  const tAccount = useTranslations('Account')
  const [confirming, setConfirming] = useState(false)

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      if (String(formData.get('confirmation') ?? '').trim() !== email) {
        return { success: false, errorKey: 'deleteConfirmationMismatch' }
      }

      const result = await deleteAccount()
      if (result.success) {
        await signOut()
        window.location.assign('/login')
      }
      return result
    },
    null
  )

  if (!confirming) {
    return (
      <div className={className ? `space-y-4 ${className}` : 'space-y-4'}>
        <p className="text-muted-foreground text-sm">{tAccount('deleteAccountWarning')}</p>
        <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
          {tAccount('deleteAccount')}
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <AuthMessage tone="error">{tAccount('deleteAccountWarning')}</AuthMessage>

      <div className="space-y-2">
        <Label htmlFor="confirmation">{tAccount('deleteConfirmationLabel', { email })}</Label>
        <Input id="confirmation" name="confirmation" type="text" required disabled={pending} />
      </div>

      {state && !state.success && (
        <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? tAccount('deletingAccount') : tAccount('deleteAccountConfirm')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          {tAccount('cancel')}
        </Button>
      </div>
    </form>
  )
}
