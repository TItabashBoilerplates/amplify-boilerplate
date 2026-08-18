'use client'

import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { confirmSignUpCode, resendSignUpConfirmation } from '../api'
import type { AuthResult } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { CodeField } from './CodeField'

/**
 * サインアップ確認コードの入力フォーム
 *
 * **「送信できた」で終わらせない**（`.claude/rules/auth.md` §6）。確認が完了するまでが
 * 1 本のフローなので、再送導線もここに置く（コードが届かない・期限切れで詰まらせない）。
 */
export function ConfirmSignUpForm({ email, className }: { email: string; className?: string }) {
  const t = useTranslations('Auth')
  const [resendState, setResendState] = useState<AuthResult | null>(null)
  const [resending, setResending] = useState(false)

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      const result = await confirmSignUpCode(email, String(formData.get('code') ?? ''))
      if (result.success && result.successKey === 'signedIn') {
        window.location.assign('/dashboard')
      }
      return result
    },
    null
  )

  const handleResend = async () => {
    setResending(true)
    setResendState(await resendSignUpConfirmation(email))
    setResending(false)
  }

  return (
    <div className={className ? `space-y-6 ${className}` : 'space-y-6'}>
      <div className="space-y-2 text-center">
        <h2 className="font-bold text-2xl">{t('confirmSignUpTitle')}</h2>
        <p className="text-muted-foreground">
          {t.rich('confirmSignUpDescription', {
            email,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <CodeField label={t('codeLabel')} disabled={pending} />

        {state && !state.success && (
          <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
        )}
        {state?.success && state.successKey && (
          <AuthMessage tone="success">{t(`success.${state.successKey}`)}</AuthMessage>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t('saving') : t('confirm')}
        </Button>
      </form>

      <div className="space-y-2 text-center">
        <Button
          type="button"
          variant="outline"
          onClick={handleResend}
          disabled={resending}
          className="w-full"
        >
          {resending ? t('saving') : t('requestNewCode')}
        </Button>
        {resendState && (
          <AuthMessage tone={resendState.success ? 'success' : 'error'}>
            {resendState.success && resendState.successKey
              ? t(`success.${resendState.successKey}`)
              : !resendState.success && t(`errors.${resendState.errorKey}`)}
          </AuthMessage>
        )}
      </div>
    </div>
  )
}
