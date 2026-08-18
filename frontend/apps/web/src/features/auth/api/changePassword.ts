import { isPasswordValid } from '@workspace/auth/validation'
import { updatePassword } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/**
 * サインイン中のユーザーのパスワードを変更する（Cognito）。
 *
 * **現在のパスワードの検証は Cognito が行う**。`oldPassword` が違えば
 * `NotAuthorizedException` が返る。
 *
 * ⚠️ **`signIn` を「検証目的で」呼んではならない**（`.claude/rules/auth.md` §3.3）。
 * 新しいセッションが発行される副作用があり、公式の手順でもない。
 *
 * @see https://docs.amplify.aws/react/build-a-backend/auth/connect-your-frontend/manage-user-session/
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<AuthResult> {
  if (oldPassword.length === 0) {
    return { success: false, errorKey: 'currentPasswordRequired' }
  }
  if (!isPasswordValid(newPassword)) {
    return { success: false, errorKey: 'passwordTooWeak' }
  }

  try {
    await updatePassword({ oldPassword, newPassword })
    return { success: true, successKey: 'passwordUpdated' }
  } catch (error) {
    return toAuthFailure('changePassword', error)
  }
}
