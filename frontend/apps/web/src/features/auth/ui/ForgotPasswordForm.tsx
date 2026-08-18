'use client'

import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Link } from '@/shared/lib/i18n/navigation'
import { requestPasswordReset } from '../api'
import type { AuthResult } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { EmailField } from './EmailField'
import { UpdatePasswordForm } from './UpdatePasswordForm'

/**
 * パスワード再設定の申請フォーム（未ログインからの復旧）
 *
 * **ログイン画面から到達できること**が必須（`.claude/rules/auth.md` §2）。
 *
 * ## アカウントの存在を漏らさない
 *
 * 送信できてもできなくても **同じ文言**（「登録があればコードを送りました」）を出す。
 * `UserNotFoundException` をそのまま表示するとユーザー列挙の入口になる。
 * api 層（`requestPasswordReset`）が既に丸めているが、UI 側でも成功扱いで進める。
 */
export function ForgotPasswordForm({ className }: { className?: string }) {
  const t = useTranslations('Auth')
  const [sentTo, setSentTo] = useState<string | null>(null)

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      const email = String(formData.get('email') ?? '')
      const result = await requestPasswordReset(email)
      if (result.success) {
        setSentTo(email)
      }
      return result
    },
    null
  )

  if (sentTo) {
    return <UpdatePasswordForm email={sentTo} className={className} />
  }

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <EmailField
        id="email"
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        disabled={pending}
      />

      {state && !state.success && (
        <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('saving') : t('sendResetCode')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          {t('backToSignIn')}
        </Link>
      </p>
    </form>
  )
}
