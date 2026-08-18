import { isPasswordValid, isValidEmail, normalizeEmail } from '@workspace/auth/validation'
import { autoSignIn, signUp } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/** サインアップ後にユーザーへ求める操作 */
export type SignUpNextStep = 'confirm' | 'signedIn'

/**
 * メールアドレス + パスワードでサインアップする（Cognito）。
 *
 * `autoSignIn` を指定しておくと、確認コードの検証が済んだ直後にそのままサインイン
 * できる（`confirmSignUpCode` が続けて `autoSignIn()` を呼ぶ）。
 *
 * **アカウントの存在を漏らさない**: 既に登録済みのアドレスだと Cognito は
 * `UsernameExistsException` を返すが、これをそのまま表示するとユーザー列挙の
 * 入口になるため一般的な文言へ丸める（`.claude/rules/auth.md` §3.2）。
 *
 * @see https://docs.amplify.aws/react/build-a-backend/auth/connect-your-frontend/sign-up/
 */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<AuthResult<SignUpNextStep>> {
  if (!isValidEmail(email)) {
    return { success: false, errorKey: 'emailInvalidFormat' }
  }
  if (!isPasswordValid(password)) {
    return { success: false, errorKey: 'passwordTooWeak' }
  }

  const username = normalizeEmail(email)

  try {
    const { nextStep } = await signUp({
      username,
      password,
      options: {
        userAttributes: { email: username },
        autoSignIn: { authFlowType: 'USER_AUTH' },
      },
    })

    switch (nextStep.signUpStep) {
      case 'CONFIRM_SIGN_UP':
        return { success: true, successKey: 'signUpConfirmationSent', nextStep: 'confirm' }
      case 'COMPLETE_AUTO_SIGN_IN':
        await autoSignIn()
        return { success: true, successKey: 'signedIn', nextStep: 'signedIn' }
      default:
        return { success: true, successKey: 'signedIn', nextStep: 'signedIn' }
    }
  } catch (error) {
    return toAuthFailure('signUpWithPassword', error, { hideAccountExistence: true })
  }
}
