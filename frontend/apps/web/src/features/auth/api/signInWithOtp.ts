import { signIn } from 'aws-amplify/auth'

/**
 * パスワードレス認証：メールアドレスに OTP を送信（Cognito Email OTP）。
 *
 * Cognito の `USER_AUTH` フロー + `EMAIL_OTP` チャレンジで、ユーザーのメールに
 * ワンタイムコードを送る。続く検証は {@link verifyOtp} で行う。
 *
 * @param email - ユーザーのメールアドレス
 * @returns 成功時 `{ success: true }`、失敗時 `{ error }`
 */
export async function signInWithOtp(email: string) {
  try {
    await signIn({
      username: email,
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'EMAIL_OTP',
      },
    })

    return { success: true as const }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'An unexpected error occurred' }
  }
}
