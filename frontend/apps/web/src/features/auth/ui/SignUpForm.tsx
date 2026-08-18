'use client'

import type { AuthResult } from '@workspace/auth/api'
import { type SignUpNextStep, signUpWithPassword } from '@workspace/auth/api'
import { passwordsMatch } from '@workspace/auth/validation'
import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Link, useRouter } from '@/shared/lib/i18n/navigation'
import { AuthMessage } from './AuthMessage'
import { ConfirmSignUpForm } from './ConfirmSignUpForm'
import { EmailField } from './EmailField'
import { PasswordField } from './PasswordField'

/**
 * メールアドレス + パスワードのサインアップフォーム
 *
 * 確認コードの入力は**同じ画面でインライン表示**する。別ページへ遷移させると
 * 入力済みのメールアドレスを持ち回る必要があり、戻る操作でも壊れやすい。
 */
export function SignUpForm({ className }: { className?: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()

  /**
   * 認証状態は Cookie に入るため、遷移後にサーバー側の判定をやり直させる。
   *
   * `window.location.assign()` を使うとロケール prefix が落ちるうえ、
   * Next.js のクライアントナビゲーションを捨てることになる
   * （`@next/next/no-location-assign-relative-destination`）。
   * next-intl の router はロケールを保ったまま遷移し、`refresh()` が
   * Server Component を新しい Cookie で再評価する。
   */
  const redirectAfterAuth = (path: string) => {
    router.replace(path)
    router.refresh()
  }
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const [state, formAction, pending] = useActionState(
    async (
      _previous: AuthResult<SignUpNextStep> | null,
      formData: FormData
    ): Promise<AuthResult<SignUpNextStep>> => {
      const email = String(formData.get('email') ?? '')

      if (!passwordsMatch(password, confirmation)) {
        return { success: false, errorKey: 'passwordMismatch' }
      }

      const result = await signUpWithPassword(email, password)

      if (result.success && result.nextStep === 'confirm') {
        setPendingEmail(email)
      }
      if (result.success && result.nextStep === 'signedIn') {
        redirectAfterAuth('/dashboard')
      }
      return result
    },
    null
  )

  if (pendingEmail) {
    return <ConfirmSignUpForm email={pendingEmail} className={className} />
  }

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <EmailField
        id="email"
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        autoComplete="username"
        disabled={pending}
      />

      <PasswordField
        name="password"
        label={t('passwordLabel')}
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

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('signingUp') : t('signUp')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          {t('signIn')}
        </Link>
      </p>
    </form>
  )
}
