/**
 * ログアウト機能
 *
 * @module features/auth/api/signOut
 */

import { createClient } from '@workspace/client-supabase/client'

/**
 * ログアウト処理
 * Supabaseセッションを削除してログイン画面にリダイレクト
 */
export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()

  // ログイン画面にリダイレクト
  window.location.href = '/login'
}
