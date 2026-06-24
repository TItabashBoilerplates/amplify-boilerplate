import { confirmSignIn } from 'aws-amplify/auth'

/**
 * OTP コードを検証してサインインを完了する（Cognito Email OTP）。
 *
 * {@link signInWithOtp} で開始したサインインのチャレンジに対し、メールで届いた
 * コードを送信する。成功時はダッシュボードへ遷移する。
 *
 * @param _email - メールアドレス（UI 互換のため受け取るが、チャレンジは進行中の
 *   サインインセッションに紐づくため未使用）
 * @param code - メールで届いた OTP コード
 * @returns 失敗時 `{ error }`（成功時は遷移するため戻らない）
 */
export async function verifyOtp(_email: string, code: string) {
  try {
    const { isSignedIn } = await confirmSignIn({ challengeResponse: code })

    if (!isSignedIn) {
      return { error: 'Verification incomplete' }
    }

    // 認証成功後、ダッシュボードへ遷移
    window.location.href = '/dashboard'
    return { success: true as const }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'An unexpected error occurred' }
  }
}
