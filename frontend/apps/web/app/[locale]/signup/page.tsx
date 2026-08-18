import { SignUpPage } from '@/views/auth'
import { Header } from '@/widgets/header'

/**
 * サインアップページ（Next.js App Router）
 *
 * URL: /signup
 */
export default function Page() {
  return (
    <div className="min-h-screen pt-16">
      <Header />
      <SignUpPage />
    </div>
  )
}
