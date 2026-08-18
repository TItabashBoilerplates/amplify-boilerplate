import { signIn } from 'aws-amplify/auth'
import { isValidEmail, normalizeEmail } from '../validation'
import { toAuthFailure } from './authResult'
import type { AuthResult } from './types'

/**
 * パスワードレス認証：メールアドレスに OTP を送信（Cognito Email OTP）。
 *
 * Cognito の `USER_AUTH` フロー + `EMAIL_OTP` チャレンジで、ユーザーのメールに
 * ワンタイムコードを送る。続く検証は {@link verifyOtp} で行う。
 *
 * これは**補助的なログイン手段**。モバイルアプリを出すプロダクトでは
 * メール + パスワード（{@link signInWithPassword}）を主手段として必ず残すこと
 * （`.claude/rules/auth.md`）。
 */
export async function signInWithOtp(email: string): Promise<AuthResult> {
  if (!isValidEmail(email)) {
    return { success: false, errorKey: 'emailInvalidFormat' }
  }

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
    return toAuthFailure('signInWithOtp', error, { hideAccountExistence: true })
  }
}
