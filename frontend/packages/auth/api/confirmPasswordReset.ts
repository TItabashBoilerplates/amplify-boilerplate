import { confirmResetPassword } from 'aws-amplify/auth'
import { isPasswordValid, normalizeEmail } from '../validation'
import { toAuthFailure } from './authResult'
import type { AuthResult } from './types'

/**
 * 届いたコードで新しいパスワードを確定する（Cognito）。
 *
 * `requestPasswordReset` とセットで 1 本のフロー。**ここまで通らないと
 * 「送信できた」だけで復帰できていない**ので、E2E もこの往復を踏むこと。
 */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<AuthResult> {
  if (code.trim().length === 0) {
    return { success: false, errorKey: 'codeRequired' }
  }
  if (!isPasswordValid(newPassword)) {
    return { success: false, errorKey: 'passwordTooWeak' }
  }

  try {
    await confirmResetPassword({
      username: normalizeEmail(email),
      confirmationCode: code.trim(),
      newPassword,
    })
    return { success: true, successKey: 'passwordUpdated' }
  } catch (error) {
    return toAuthFailure('confirmPasswordReset', error)
  }
}
