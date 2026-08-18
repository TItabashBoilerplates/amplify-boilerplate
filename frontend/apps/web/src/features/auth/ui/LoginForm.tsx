'use client'

import type { AuthResult } from '@workspace/auth/api'
import { signInWithOtp } from '@workspace/auth/api'
import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import type { LoginFormProps } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { EmailField } from './EmailField'
import { VerifyOTPForm } from './VerifyOTPForm'

/**
 * ワンタイムコード（Email OTP）でログインするフォーム
 *
 * **これは補助的なログイン手段**。主たる手段はメール + パスワード
 * （{@link PasswordLoginForm}）で、モバイルアプリを出すプロダクトでは
 * パスワードログインが無いと App Store Review 2.1(a) でリジェクトされる
 * （`.claude/rules/auth.md`）。
 *
 * OTP 送信後は**同一ページ内で**検証フォームを表示する。別ページ（/verify）へ遷移すると
 * Amplify の進行中サインインセッション（メモリ保持）が失われ、`confirmSignIn` が
 * "session has expired" で失敗する。
 */
export function LoginForm({ className }: LoginFormProps) {
  const t = useTranslations('Auth')
  const [sentTo, setSentTo] = useState<string | null>(null)

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      const email = String(formData.get('email') ?? '')
      const result = await signInWithOtp(email)
      if (result.success) {
        setSentTo(email)
      }
      return result
    },
    null
  )

  if (sentTo) {
    return <VerifyOTPForm email={sentTo} className={className} />
  }

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <EmailField
        id="otpEmail"
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        disabled={pending}
      />

      {state && !state.success && (
        <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('sending') : t('sendOtp')}
      </Button>

      <p className="text-center text-muted-foreground text-sm">{t('otpHint')}</p>
    </form>
  )
}
