import { normalizeEmail } from '@workspace/auth/validation'
import { autoSignIn, confirmSignUp } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/**
 * サインアップの確認コードを検証する（Cognito）。
 *
 * `signUpWithPassword` が `autoSignIn` を指定しているため、確認が完了すると
 * `nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN'` になり、続けて
 * `autoSignIn()` を呼ぶだけでサインインが完了する（もう一度パスワードを
 * 入力させない）。
 */
export async function confirmSignUpCode(email: string, code: string): Promise<AuthResult> {
  if (code.trim().length === 0) {
    return { success: false, errorKey: 'codeRequired' }
  }

  try {
    const { nextStep } = await confirmSignUp({
      username: normalizeEmail(email),
      confirmationCode: code.trim(),
    })

    if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
      await autoSignIn()
      return { success: true, successKey: 'signedIn' }
    }

    return { success: true, successKey: 'signUpConfirmed' }
  } catch (error) {
    return toAuthFailure('confirmSignUpCode', error)
  }
}
