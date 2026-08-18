'use client'

import { passwordsMatch } from '@workspace/auth/validation'
import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Link } from '@/shared/lib/i18n/navigation'
import { confirmPasswordReset } from '../api'
import type { AuthResult } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { CodeField } from './CodeField'
import { PasswordField } from './PasswordField'

/**
 * 届いたコードで新しいパスワードを確定するフォーム
 *
 * Cognito のパスワード再設定は**コードベース**なので、Web も Mobile もこの形になる
 * （メールリンクのディープリンク往復やリンクの事前消費といった問題が無い）。
 */
export function UpdatePasswordForm({ email, className }: { email: string; className?: string }) {
  const t = useTranslations('Auth')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      if (!passwordsMatch(password, confirmation)) {
        return { success: false, errorKey: 'passwordMismatch' }
      }
      return confirmPasswordReset(email, String(formData.get('code') ?? ''), password)
    },
    null
  )

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <AuthMessage tone="success">{t('success.passwordResetCodeSent')}</AuthMessage>

      <CodeField label={t('codeLabel')} disabled={pending} />

      <PasswordField
        name="password"
        label={t('newPasswordLabel')}
        autoComplete="new-password"
        disabled={pending}
        showRequirements
        value={password}
        onValueChange={setPassword}
      />

      <PasswordField
        name="passwordConfirmation"
        label={t('passwordConfirmationLabel')}
        autoComplete="new-password"
        disabled={pending}
        value={confirmation}
        onValueChange={setConfirmation}
      />

      {state && !state.success && (
        <AuthMessage tone="error">{t(`errors.${state.errorKey}`)}</AuthMessage>
      )}
      {state?.success && state.successKey && (
        <AuthMessage tone="success">{t(`success.${state.successKey}`)}</AuthMessage>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('saving') : t('updatePassword')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          {t('backToSignIn')}
        </Link>
      </p>
    </form>
  )
}
