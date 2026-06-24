import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { LogIn } from 'lucide-react'
import { LoginForm } from '@/features/auth'

/**
 * ログインページ
 *
 * パスワードレスOTP認証のログインページ
 * メールアドレスを入力してOTPコードを送信
 *
 * @example
 * ```tsx
 * // app/[locale]/auth/login/page.tsx
 * import { LoginPage } from '@/views/auth'
 *
 * export default function Page() {
 *   return <LoginPage />
 * }
 * ```
 */
export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <LogIn className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Sign In</CardTitle>
          </div>
          <CardDescription>Enter your email address to receive a one-time password</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
