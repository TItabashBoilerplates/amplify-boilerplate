'use client'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Mail } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useActionState, useState } from 'react'
import { signInWithOtp } from '../api'
import type { AuthFormState, LoginFormProps } from '../model/types'

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
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const [state, formAction, pending] = useActionState(
    async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
      const emailValue = formData.get('email') as string

      if (!emailValue) {
        return {
          success: false,
          message: 'Email address is required',
        }
      }

      try {
        // localeを渡してEmailテンプレートの言語を切り替え
        const result = await signInWithOtp(emailValue, locale)

        if ('error' in result) {
          return {
            success: false,
            message: result.error ?? 'An error occurred',
          }
        }

        // 成功時、メールアドレスを保存してOTP入力画面に遷移
        setEmail(emailValue)
        setOtpSent(true)

        return {
          success: true,
          message: 'Check your email for the OTP code!',
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        }
      }
    },
    { success: false, message: '' }
  )

  // OTP送信後は検証フォームにリダイレクト
  // または、親コンポーネントで状態管理してもOK
  if (otpSent) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold">Check Your Email</h2>
          <p className="text-muted-foreground">
            We&apos;ve sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Please check your email and enter the code on the verification page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className={`space-y-4 ${className ?? ''}`}>
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="your.email@example.com"
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
        {pending ? 'Sending...' : 'Send One-Time Password'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        We&apos;ll send you a 6-digit code to verify your email.
      </p>
    </form>
  )
}
