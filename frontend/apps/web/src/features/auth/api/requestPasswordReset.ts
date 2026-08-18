import { isValidEmail, normalizeEmail } from '@workspace/auth/validation'
import { resetPassword } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/**
 * パスワード再設定コードを送る（Cognito）。
 *
 * Cognito のパスワードリセットは**コードベース**なので、Web / Mobile とも同じ
 * 実装でよい（ディープリンク・メールリンクの事前消費といった問題が無い）。
 *
 * **アカウントの存在を漏らさない**: `UserNotFoundException` をそのまま表示すると
 * ユーザー列挙の入口になる。呼び出し側は成功・失敗にかかわらず
 * 「登録があればコードを送りました」と表示すること（`.claude/rules/auth.md` §3.2）。
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isValidEmail(email)) {
    return { success: false, errorKey: 'emailInvalidFormat' }
  }

  try {
    await resetPassword({ username: normalizeEmail(email) })
    return { success: true, successKey: 'passwordResetCodeSent' }
  } catch (error) {
    return toAuthFailure('requestPasswordReset', error, { hideAccountExistence: true })
  }
}
