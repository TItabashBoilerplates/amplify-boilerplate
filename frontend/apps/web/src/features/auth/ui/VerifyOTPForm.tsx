'use client'

import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { resendOtp, verifyOtp } from '../api'
import type { AuthResult, VerifyOTPFormProps } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { CodeField } from './CodeField'

/**
 * Email OTP の検証フォーム
 *
 * チャレンジは進行中のサインインセッションに紐づくため、コードだけを送る
 * （メールアドレスは再送導線と表示にのみ使う）。
 */
export function VerifyOTPForm({ email, redirectTo = '/dashboard', className }: VerifyOTPFormProps) {
  const t = useTranslations('Auth')
  const [resending, setResending] = useState(false)
  const [resendState, setResendState] = useState<AuthResult | null>(null)

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      const result = await verifyOtp(String(formData.get('code') ?? ''))
      if (result.success) {
        // 認証状態は Cookie に入るため、フルリロードでサーバー側の判定をやり直す
        window.location.assign(redirectTo)
      }
      return result
    },
    null
  )

  const handleResend = async () => {
    setResending(true)
    setResendState(await resendOtp(email))
    setResending(false)
  }

  return (
    <div className={className ? `space-y-6 ${className}` : 'space-y-6'}>
      <div className="space-y-2 text-center">
        <h2 className="font-bold text-2xl">{t('verifyTitle')}</h2>
        <p className="text-muted-foreground">
          {t.rich('verifyBody', { email, strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <CodeField label={t('otpLabel')} disabled={pending} />

        {state && !state.success && (
          <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t('verifying') : t('verifyButton')}
        </Button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-muted-foreground text-sm">{t('didntReceiveCode')}</p>
        <Button
          type="button"
          variant="outline"
          onClick={handleResend}
          disabled={resending}
          className="w-full"
        >
          {resending ? t('sending') : t('resendButton')}
        </Button>

        {resendState && (
          <AuthMessage tone={resendState.success ? 'success' : 'error'}>
            {resendState.success ? t('resendSuccess') : t(`errors.${resendState.errorKey}`)}
          </AuthMessage>
        )}
      </div>
    </div>
  )
}
