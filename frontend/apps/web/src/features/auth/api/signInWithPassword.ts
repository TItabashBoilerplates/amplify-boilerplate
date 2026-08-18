import { isValidEmail, normalizeEmail } from '@workspace/auth/validation'
import { signIn } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/** サインイン後にユーザーへ求める操作 */
export type SignInNextStep = 'signedIn' | 'confirmSignUp' | 'resetPassword' | 'confirmSignIn'

/**
 * メールアドレス + パスワードでサインインする（Cognito）。
 *
 * **`nextStep` を必ず分岐する**（`.claude/rules/auth.md` §3.1）。
 * `isSignedIn` が false でも原因は複数あり、
 *
 * - `CONFIRM_SIGN_UP`  … 未確認ユーザー。「パスワードが違います」と出してはならない
 * - `RESET_PASSWORD`   … 管理者がリセットを要求した状態。再設定導線へ送る
 *
 * これらを一律に「ログインに失敗しました」と表示すると、ユーザーはログイン画面で
 * 行き止まりになる。
 *
 * @see https://docs.amplify.aws/react/build-a-backend/auth/connect-your-frontend/sign-in/
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult<SignInNextStep>> {
  if (!isValidEmail(email)) {
    return { success: false, errorKey: 'emailInvalidFormat' }
  }
  if (password.length === 0) {
    return { success: false, errorKey: 'passwordRequired' }
  }

  try {
    const { isSignedIn, nextStep } = await signIn({
      username: normalizeEmail(email),
      password,
    })

    if (isSignedIn) {
      return { success: true, successKey: 'signedIn', nextStep: 'signedIn' }
    }

    switch (nextStep.signInStep) {
      case 'CONFIRM_SIGN_UP':
        return {
          success: false,
          errorKey: 'emailNotConfirmed',
          requiresConfirmation: true,
        }
      case 'RESET_PASSWORD':
        return {
          success: false,
          errorKey: 'passwordResetRequired',
          requiresPasswordReset: true,
        }
      default:
        // MFA / 新パスワード要求など、追加のチャレンジが要る状態
        return { success: true, nextStep: 'confirmSignIn' }
    }
  } catch (error) {
    return toAuthFailure('signInWithPassword', error)
  }
}
