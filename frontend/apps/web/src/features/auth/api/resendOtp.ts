import { resendSignInCode } from 'aws-amplify/auth'

/**
 * OTP コードを再送信する（Cognito Email OTP）。
 *
 * @param email - ユーザーのメールアドレス
 * @returns 成功時 `{ success: true }`、失敗時 `{ error }`
 */
export async function resendOtp(email: string) {
  try {
    await resendSignInCode({ username: email })
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
