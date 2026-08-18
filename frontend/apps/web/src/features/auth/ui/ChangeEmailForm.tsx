'use client'

import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { changeEmail, confirmEmailChange } from '../api'
import type { AuthResult } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { CodeField } from './CodeField'
import { EmailField } from './EmailField'

/**
 * メールアドレス変更フォーム（設定画面）
 *
 * **認証方式が OTP でもパスワードでも必須の導線**（`.claude/rules/auth.md` §2）。
 * アドレスが変わったユーザーは、これが無いと自力でアカウントへ戻れない。
 *
 * ## 2 段階であることを UI で明示する
 *
 * backend が `AttributesRequireVerificationBeforeUpdate: ['email']` を設定しているため、
 * **新アドレスの確認が完了するまで現在のアドレスが有効なまま**である。
 * その旨を書かないと「変わっていない」という問い合わせになる。
 */
export function ChangeEmailForm({
  currentEmail,
  className,
}: {
  currentEmail: string
  className?: string
}) {
  const t = useTranslations('Auth')
  const [awaitingCode, setAwaitingCode] = useState(false)

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      if (awaitingCode) {
        const result = await confirmEmailChange(String(formData.get('code') ?? ''))
        if (result.success) {
          setAwaitingCode(false)
        }
        return result
      }

      const result = await changeEmail(String(formData.get('email') ?? ''))
      if (result.success) {
        setAwaitingCode(true)
      }
      return result
    },
    null
  )

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <p className="text-muted-foreground text-sm">
        {t('currentEmail')}: <strong className="text-foreground">{currentEmail}</strong>
      </p>

      {awaitingCode ? (
        <CodeField label={t('codeLabel')} disabled={pending} />
      ) : (
        <>
          <EmailField
            id="newEmail"
            label={t('newEmailLabel')}
            placeholder={t('emailPlaceholder')}
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">{t('emailChangeVerificationNotice')}</p>
        </>
      )}

      {state && !state.success && (
        <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
      )}
      {state?.success && state.successKey && (
        <AuthMessage tone="success">{t(`success.${state.successKey}`)}</AuthMessage>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? t('saving') : awaitingCode ? t('confirm') : t('changeEmail')}
      </Button>
    </form>
  )
}
