import { signOut as amplifySignOut } from 'aws-amplify/auth'

/**
 * ログアウト処理
 *
 * Amplify (Cognito) のセッションを破棄してログイン画面へ遷移する。
 *
 * @module features/auth/api/signOut
 */
export async function signOut(): Promise<void> {
  await amplifySignOut()

  // ログイン画面にリダイレクト
  window.location.href = '/login'
}
