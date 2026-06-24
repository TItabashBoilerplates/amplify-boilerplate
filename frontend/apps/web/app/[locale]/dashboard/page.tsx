import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerClient as createClient } from '@/shared/lib/supabase'
import {
  DashboardBackendInfo,
  DashboardBackendInfoSkeleton,
  DashboardPage,
} from '@/views/dashboard'
import { Header } from '@/widgets/header'

/**
 * ダッシュボードページ（Server Component - 認証必須）
 *
 * 認証チェックだけを shell 描画前に await し、バックエンド API 取得は
 * Suspense で分離してストリーミング。ページ遷移直後にヘッダーとユーザー情報が
 * 描画され、バックエンド応答は後から差し込まれる。
 */
export default async function Page() {
  await cookies()

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? null

  return (
    <div className="min-h-screen pt-16">
      <Header />
      <DashboardPage
        userEmail={user.email || 'Unknown'}
        backendSlot={
          <Suspense fallback={<DashboardBackendInfoSkeleton />}>
            <DashboardBackendInfo accessToken={accessToken} />
          </Suspense>
        }
      />
    </div>
  )
}
