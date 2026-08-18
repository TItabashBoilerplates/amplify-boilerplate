import { ForgotPasswordPage } from '@/views/auth'
import { Header } from '@/widgets/header'

/**
 * パスワード再設定ページ（Next.js App Router）
 *
 * **ログイン画面からリンクされていること**が必須（`.claude/rules/auth.md` §2）。
 *
 * URL: /forgot-password
 */
export default function Page() {
  return (
    <div className="min-h-screen pt-16">
      <Header />
      <ForgotPasswordPage />
    </div>
  )
}
