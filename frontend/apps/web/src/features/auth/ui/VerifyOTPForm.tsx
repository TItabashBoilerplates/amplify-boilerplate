'use client'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { KeyRound } from 'lucide-react'
import { useActionState, useState } from 'react'
import { resendOtp, verifyOtp } from '../api'
import type { AuthFormState, VerifyOTPFormProps } from '../model/types'

/**
 * OTP検証フォームコンポーネント
 *
 * 6桁のOTPコードを入力して認証するフォーム
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
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const [state, formAction, pending] = useActionState(
    async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
      const token = formData.get('token') as string

      try {
        const result = await verifyOtp(email, token)

        if ('error' in result) {
          return {
            success: false,
            message: result.error,
          }
        }

        // 成功時は verifyOtp 内で redirect されるため、ここには到達しない
        return {
          success: true,
          message: 'Verification successful! Redirecting...',
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

  const handleResendOtp = async () => {
    setResending(true)
    setResendMessage('')

    try {
      const result = await resendOtp(email)

      if ('error' in result) {
        setResendMessage(result.error ?? 'An error occurred')
      } else {
        setResendMessage('New code sent! Check your email.')
      }
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : 'Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Verify Your Email</h2>
        <p className="text-muted-foreground">
          Enter the 6-digit code sent to <strong>{email}</strong>
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">One-Time Password</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="token"
              name="token"
              type="text"
              placeholder="000000"
              required
              disabled={pending}
              className="pl-10 text-center text-2xl tracking-widest"
              maxLength={6}
              pattern="[0-9]{6}"
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
          {pending ? 'Verifying...' : 'Verify Code'}
        </Button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">Didn&apos;t receive the code?</p>
        <Button
          type="button"
          variant="outline"
          onClick={handleResendOtp}
          disabled={resending}
          className="w-full"
        >
          {resending ? 'Sending...' : 'Resend Code'}
        </Button>

        {resendMessage && (
          <p
            className={`text-sm ${
              resendMessage.includes('sent')
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {resendMessage}
          </p>
        )}
      </div>
    </div>
  )
}
