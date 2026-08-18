import { confirmSignIn } from 'aws-amplify/auth'
import { toAuthFailure } from './authResult'
import type { AuthResult } from './types'

/**
 * OTP コードを検証してサインインを完了する（Cognito Email OTP）。
 *
 * {@link signInWithOtp} で開始したサインインのチャレンジに対し、メールで届いた
 * コードを送信する。チャレンジは進行中のサインインセッションに紐づくため、
 * メールアドレスを再送する必要は無い。
 *
 * 遷移は**呼び出し側（UI）の責務**にしている。api 層が `window.location` を
 * 触ると、テストもできず Storybook でも動かせないため。
 */
export async function verifyOtp(code: string): Promise<AuthResult> {
  if (code.trim().length === 0) {
    return { success: false, errorKey: 'codeRequired' }
  }

  try {
    const { isSignedIn } = await confirmSignIn({ challengeResponse: code.trim() })

    if (!isSignedIn) {
      return { success: false, errorKey: 'codeMismatch' }
    }

    return { success: true, successKey: 'signedIn' }
  } catch (error) {
    return toAuthFailure('verifyOtp', error)
  }
}
