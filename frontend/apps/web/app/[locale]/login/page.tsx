import { LoginPage } from '@/views/auth'
import { Header } from '@/widgets/header'

/**
 * ログインページ（Next.js App Router）
 *
 * パスワードレスOTP認証のログインページ
 * 国際化対応（ボタンベースの言語切り替え）
 *
 * @example
 * URL: /login
 */
export default function Page() {
  return (
    <div className="min-h-screen pt-16">
      <Header />
      <LoginPage />
    </div>
  )
}
