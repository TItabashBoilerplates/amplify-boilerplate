import { signIn } from 'aws-amplify/auth'
import { normalizeEmail } from '../validation'
import { toAuthFailure } from './authResult'
import type { AuthResult } from './types'

/**
 * OTP コードを再送信する（Cognito Email OTP）。
 *
 * `USER_AUTH` フローのサインインチャレンジには専用の resend API が無いため、
 * `signIn` を同条件で再実行してサインインを開始し直し、新しいコードを送る。
 *
 * 連打はレート制限（`LimitExceededException` 等）に当たるので、UI 側で
 * 再送ボタンをクールダウンさせること。
 */
export async function resendOtp(email: string): Promise<AuthResult> {
  try {
    await signIn({
      username: normalizeEmail(email),
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'EMAIL_OTP',
      },
    })
    return { success: true }
  } catch (error) {
    return toAuthFailure('resendOtp', error, { hideAccountExistence: true })
  }
}
