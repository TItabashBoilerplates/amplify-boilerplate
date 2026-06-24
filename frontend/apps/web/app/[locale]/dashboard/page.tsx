import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'
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
 * Suspense で分離してストリーミング。認証は Amplify (Cognito) の
 * サーバーコンテキストで行う。
 */
export default async function Page() {
  const auth = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        const user = await getCurrentUser(contextSpec)
        const session = await fetchAuthSession(contextSpec)
        const accessToken = session.tokens?.accessToken?.toString() ?? null
        const email =
          (session.tokens?.idToken?.payload?.email as string | undefined) ?? user.username
        return { email, accessToken }
      } catch {
        // 未認証
        return null
      }
    },
  })

  if (!auth) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen pt-16">
      <Header />
      <DashboardPage
        userEmail={auth.email ?? 'Unknown'}
        backendSlot={
          <Suspense fallback={<DashboardBackendInfoSkeleton />}>
            <DashboardBackendInfo accessToken={auth.accessToken} />
          </Suspense>
        }
      />
    </div>
  )
}
