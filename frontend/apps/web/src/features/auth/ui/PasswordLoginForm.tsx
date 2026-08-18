'use client'

import type { AuthFailure, AuthResult } from '@workspace/auth/api'
import { type SignInNextStep, signInWithPassword } from '@workspace/auth/api'
import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Link, useRouter } from '@/shared/lib/i18n/navigation'
import { AuthMessage } from './AuthMessage'
import { EmailField } from './EmailField'
import { PasswordField } from './PasswordField'

/**
 * メールアドレス + パスワードのログインフォーム（主たるログイン手段）
 *
 * **モバイルアプリを出すプロダクトでは、これが無いと App Store Review 2.1(a) で
 * リジェクトされる**（審査担当者に渡せる資格情報が存在しないため）。
 * OTP / passkey は補助手段として併置する（`.claude/rules/auth.md`）。
 *
 * ## 行き止まりを作らない
 *
 * - **「パスワードをお忘れですか？」はこのフォーム内に置く**。パスワードを忘れた人は
 *   ログインできないのだから、設定画面に置いても到達できない。
 * - `requiresPasswordReset` / `requiresConfirmation` を受けたら、
 *   エラーを出すだけでなく**次に行くべき画面へのリンクを出す**。
 */
export function PasswordLoginForm({ className }: { className?: string }) {
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
  const [recovery, setRecovery] = useState<Pick<
    AuthFailure,
    'requiresPasswordReset' | 'requiresConfirmation'
  > | null>(null)

  const [state, formAction, pending] = useActionState(
    async (
      _previous: AuthResult<SignInNextStep> | null,
      formData: FormData
    ): Promise<AuthResult<SignInNextStep>> => {
      const email = String(formData.get('email') ?? '')
      const password = String(formData.get('password') ?? '')

      const result = await signInWithPassword(email, password)

      if (result.success) {
        setRecovery(null)
        if (result.nextStep === 'signedIn') {
          // 認証状態は Cookie に入るため、フルリロードでサーバー側の判定をやり直す
          redirectAfterAuth('/dashboard')
        }
        return result
      }

      setRecovery({
        requiresPasswordReset: result.requiresPasswordReset,
        requiresConfirmation: result.requiresConfirmation,
      })
      return result
    },
    null
  )

  return (
    <form action={formAction} className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      <EmailField
        id="email"
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        autoComplete="username"
        disabled={pending}
      />

      <div className="space-y-2">
        <PasswordField
          name="password"
          label={t('passwordLabel')}
          autoComplete="current-password"
          disabled={pending}
        />
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>
      </div>

      {state && !state.success && (
        <AuthMessage tone="error">
          {t(`errors.${state.errorKey}`)}
          {recovery?.requiresPasswordReset && (
            <>
              {' '}
              <Link href="/forgot-password" className="underline underline-offset-4">
                {t('resetPasswordNow')}
              </Link>
            </>
          )}
          {recovery?.requiresConfirmation && (
            <>
              {' '}
              <Link href="/signup" className="underline underline-offset-4">
                {t('confirmEmailNow')}
              </Link>
            </>
          )}
        </AuthMessage>
      )}

      {state?.success && state.successKey && (
        <AuthMessage tone="success">{t(`success.${state.successKey}`)}</AuthMessage>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('signingIn') : t('signIn')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/signup" className="underline underline-offset-4 hover:text-foreground">
          {t('signUp')}
        </Link>
      </p>
    </form>
  )
}
