import { deleteUser } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/**
 * アカウントを削除する（Cognito）。
 *
 * **アカウント作成ができるアプリでは、アプリ内の削除導線が App Store 5.1.1(v) で必須**
 * （`.claude/rules/store-review.md` §4）。「サポートへ連絡」では不可。
 *
 * ⚠️ **`deleteUser()` は Cognito のユーザーだけを消す。Amplify Data（DynamoDB）の
 * データは残る。** owner 認可のモデルを持つプロダクトでは、削除フローの一部として
 * 関連データも明示的に消すこと（`.claude/rules/auth.md` §3.5）。
 * 消し漏れは「退会したのにデータが残る」＝法令・審査の両面でリスクになる。
 *
 * 誤タップ防止のため、呼び出し側で**メールアドレスの再入力による確認**を必須にしている
 * （{@link DeleteAccountForm}）。
 */
export async function deleteAccount(): Promise<AuthResult> {
  try {
    await deleteUser()
    return { success: true, successKey: 'accountDeleted' }
  } catch (error) {
    return toAuthFailure('deleteAccount', error)
  }
}
