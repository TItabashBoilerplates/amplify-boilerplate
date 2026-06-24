import { redirect } from 'next/navigation'
import { VerifyOTPPage } from '@/views/auth'
import { Header } from '@/widgets/header'

interface PageProps {
  searchParams: Promise<{
    email?: string
  }>
}

/**
 * OTP検証ページ（Next.js App Router）
 *
 * メールで受け取った6桁のOTPコードを入力して認証
 * 国際化対応（ボタンベースの言語切り替え）
 *
 * @param searchParams - URLクエリパラメータ（email）
 *
 * @example
 * URL: /verify?email=user@example.com
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const { email } = params

  // メールアドレスがない場合はログインページにリダイレクト
  if (!email) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen pt-16">
      <Header />
      <VerifyOTPPage email={email} />
    </div>
  )
}
