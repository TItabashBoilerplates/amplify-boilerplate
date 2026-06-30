'use client'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { resendOtp, verifyOtp } from '../api'
import type { AuthFormState, VerifyOTPFormProps } from '../model/types'

/**
 * OTP検証フォームコンポーネント
 *
 * OTP コードを入力して認証するフォーム（コード長は Cognito 側に依存）
 *
 * @param email - メールアドレス（親コンポーネントから渡される）
 * @param redirectTo - 検証後のリダイレクト先（オプション）
 * @param className - カスタムCSSクラス
 *
 * @example
 * ```tsx
 * import { VerifyOTPForm } from '@/features/auth'
 *
 * export function VerifyPage({ searchParams }: { searchParams: { email: string } }) {
 *   return <VerifyOTPForm email={searchParams.email} />
 * }
 * ```
 */
export function VerifyOTPForm({ email, className }: VerifyOTPFormProps) {
  const t = useTranslations('auth')
  const [resending, setResending] = useState(false)
  const [resend, setResend] = useState<{ text: string; isError: boolean } | null>(null)

  const [state, formAction, pending] = useActionState(
    async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
      const token = formData.get('token') as string

      try {
        const result = await verifyOtp(email, token)

        if ('error' in result) {
          return {
            success: false,
            message: result.error ?? t('verifyFailed'),
          }
        }

        // 成功時は verifyOtp 内で redirect されるため、ここには到達しない
        return {
          success: true,
          message: t('verifySuccess'),
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

  const handleResendOtp = async () => {
    setResending(true)
    setResend(null)

    try {
      const result = await resendOtp(email)

      if ('error' in result) {
        setResend({ text: result.error ?? t('genericError'), isError: true })
      } else {
        setResend({ text: t('resendSuccess'), isError: false })
      }
    } catch (error) {
      setResend({
        text: error instanceof Error ? error.message : t('resendFailed'),
        isError: true,
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">{t('verifyTitle')}</h2>
        <p className="text-muted-foreground">
          {t.rich('verifyBody', { email, strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">{t('otpLabel')}</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="token"
              name="token"
              type="text"
              placeholder="00000000"
              required
              disabled={pending}
              className="pl-10 text-center text-2xl tracking-widest"
              maxLength={8}
              pattern="[0-9]{6,8}"
              autoComplete="one-time-code"
              inputMode="numeric"
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
          {pending ? t('verifying') : t('verifyButton')}
        </Button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">{t('didntReceiveCode')}</p>
        <Button
          type="button"
          variant="outline"
          onClick={handleResendOtp}
          disabled={resending}
          className="w-full"
        >
          {resending ? t('sending') : t('resendButton')}
        </Button>

        {resend && (
          <p
            className={`text-sm ${
              resend.isError
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {resend.text}
          </p>
        )}
      </div>
    </div>
  )
}
