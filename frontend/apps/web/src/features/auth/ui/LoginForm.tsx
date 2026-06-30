'use client'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { signInWithOtp } from '../api'
import type { AuthFormState, LoginFormProps } from '../model/types'
import { SocialSignInButtons } from './SocialSignInButtons'
import { VerifyOTPForm } from './VerifyOTPForm'

/**
 * OTP送信フォームコンポーネント
 *
 * メールアドレスを入力してOTPを送信するフォーム
 *
 * @param redirectTo - 送信後のリダイレクト先（オプション）
 * @param className - カスタムCSSクラス
 *
 * @example
 * ```tsx
 * import { LoginForm } from '@/features/auth'
 *
 * export function LoginPage() {
 *   return <LoginForm />
 * }
 * ```
 */
export function LoginForm({ className }: LoginFormProps) {
  const t = useTranslations('auth')
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const [state, formAction, pending] = useActionState(
    async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
      const emailValue = formData.get('email') as string

      if (!emailValue) {
        return {
          success: false,
          message: t('emailRequired'),
        }
      }

      try {
        const result = await signInWithOtp(emailValue)

        if ('error' in result) {
          return {
            success: false,
            message: result.error ?? t('genericError'),
          }
        }

        // 成功時、メールアドレスを保存してOTP入力画面に遷移
        setEmail(emailValue)
        setOtpSent(true)

        return {
          success: true,
          message: t('otpSentSuccess'),
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : t('unexpectedError'),
        }
      }
    },
    { success: false, message: '' }
  )

  // OTP送信後は検証フォームにリダイレクト
  // または、親コンポーネントで状態管理してもOK
  // OTP 送信後は同一ページ内で検証フォームを表示する。
  // 別ページ（/verify）へ遷移すると Amplify の進行中サインインセッション（メモリ保持）が
  // 失われ confirmSignIn が "session has expired" で失敗するため、ここでインライン表示する。
  if (otpSent) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <VerifyOTPForm email={email} />
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              required
              disabled={pending}
              className="pl-10"
              autoComplete="email"
            />
          </div>
        </div>

        {state.message && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              state.success
                ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                : 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'
            }`}
          >
            {state.message}
          </div>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t('sending') : t('sendOtp')}
        </Button>

        <p className="text-center text-sm text-muted-foreground">{t('otpHint')}</p>
      </form>

      {/* ソーシャルログイン（バックエンドで externalProviders を有効化したプロバイダのみ表示）。
          未有効化なら providers={[]} で非表示にできる。 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{t('orContinueWith')}</span>
        </div>
      </div>

      <SocialSignInButtons />
    </div>
  )
}
