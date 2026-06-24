import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { ShieldCheck } from 'lucide-react'
import { VerifyOTPForm } from '@/features/auth'

interface VerifyOTPPageProps {
  /**
   * メールアドレス（URLパラメータから取得）
   */
  email: string
}

/**
 * OTP検証ページ
 *
 * メールで受け取った6桁のOTPコードを入力して認証
 *
 * @param email - 認証対象のメールアドレス
 *
 * @example
 * ```tsx
 * // app/[locale]/auth/verify/page.tsx
 * import { VerifyOTPPage } from '@/views/auth'
 *
 * export default function Page({
 *   searchParams,
 * }: {
 *   searchParams: { email: string }
 * }) {
 *   return <VerifyOTPPage email={searchParams.email} />
 * }
 * ```
 */
export function VerifyOTPPage({ email }: VerifyOTPPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Verify Email</CardTitle>
          </div>
          <CardDescription>Enter the 6-digit code we sent to your email</CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyOTPForm email={email} />
        </CardContent>
      </Card>
    </div>
  )
}
