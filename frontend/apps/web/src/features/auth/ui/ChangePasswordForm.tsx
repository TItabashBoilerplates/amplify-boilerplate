'use client'

import { passwordsMatch } from '@workspace/auth/validation'
import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { changePassword } from '../api'
import type { AuthResult } from '../model/types'
import { AuthMessage } from './AuthMessage'
import { PasswordField } from './PasswordField'

/**
 * パスワード変更フォーム（設定画面）
 *
 * 現在のパスワードの検証は **Cognito に任せる**（`updatePassword({ oldPassword, newPassword })`）。
 * `signIn` を検証目的で呼ぶのは、新セッションが発行される副作用があり誤り
 * （`.claude/rules/auth.md` §3.3）。
 */
export function ChangePasswordForm({ className }: { className?: string }) {
  const t = useTranslations('Auth')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult | null, formData: FormData): Promise<AuthResult> => {
      if (!passwordsMatch(password, confirmation)) {
        return { success: false, errorKey: 'passwordMismatch' }
      }
      return changePassword(String(formData.get('currentPassword') ?? ''), password)
    },
    null
  )

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <PasswordField
        name="currentPassword"
        label={t('currentPasswordLabel')}
        autoComplete="current-password"
        disabled={pending}
      />

      <PasswordField
        name="newPassword"
        label={t('newPasswordLabel')}
        autoComplete="new-password"
        disabled={pending}
        showRequirements
        value={password}
        onValueChange={setPassword}
      />

      <PasswordField
        name="newPasswordConfirmation"
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

      <Button type="submit" disabled={pending}>
        {pending ? t('saving') : t('updatePassword')}
      </Button>
    </form>
  )
}
