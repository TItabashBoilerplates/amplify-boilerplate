import { signOut as amplifySignOut } from 'aws-amplify/auth'

/**
 * ログアウト処理
 *
 * Amplify (Cognito) のセッションを破棄する。
 *
 * @param options.global - true のとき**全端末**のトークンを失効させる。
 *   パスワード変更後など、他端末のセッションも切りたい場面で使う
 *   （`.claude/rules/auth.md` §3.3）。
 */
export async function signOut(options: { global?: boolean } = {}): Promise<void> {
  await amplifySignOut({ global: options.global ?? false })
}
