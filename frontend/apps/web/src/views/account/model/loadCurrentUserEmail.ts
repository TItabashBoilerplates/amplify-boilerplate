import { fetchUserAttributes } from 'aws-amplify/auth/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify'

/**
 * サインイン中のユーザーのメールアドレスをサーバー側で解決する。
 *
 * **クライアント（`useAuthUser()`）の値をサーバーの判断根拠にしない**
 * （`.claude/rules/auth.md` §3.7）。Cookie コンテキストを通した結果だけを信用する。
 *
 * 未サインインなら `/login` へ送る（アカウント設定は認証必須の画面）。
 */
export async function loadCurrentUserEmail(): Promise<string> {
  const attributes = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        return await fetchUserAttributes(contextSpec)
      } catch (error) {
        // 未サインインは例外で表現される（想定内の制御フロー）。
        // それ以外の失敗を握りつぶさないよう、必ずログに残す。
        console.error('[account] failed to resolve current user attributes:', error)
        return null
      }
    },
  })

  if (!attributes?.email) {
    redirect('/login')
  }

  return attributes.email
}
