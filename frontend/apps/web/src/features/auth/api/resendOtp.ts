import { signIn } from 'aws-amplify/auth'

/**
 * OTP コードを再送信する（Cognito Email OTP）。
 *
 * `USER_AUTH` フローのサインインチャレンジには専用の resend API が無いため、
 * `signIn` を同条件で再実行してサインインを開始し直し、新しいコードを送る。
 *
 * @param email - ユーザーのメールアドレス
 * @returns 成功時 `{ success: true }`、失敗時 `{ error }`
 */
export async function resendOtp(email: string) {
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
      if (error.message.toLowerCase().includes('limit')) {
        return { error: 'Please wait before requesting a new code' }
      }
      return { error: error.message }
    }
    return { error: 'An unexpected error occurred' }
  }
}
