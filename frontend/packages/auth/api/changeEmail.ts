import { updateUserAttributes } from 'aws-amplify/auth'
import { isValidEmail, normalizeEmail } from '../validation'
import { toAuthFailure } from './authResult'
import type { AuthResult } from './types'

/**
 * メールアドレスの変更を申請する（Cognito）。確定は {@link confirmEmailChange}。
 *
 * ⚠️ **backend 側に `UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate
 * = ['email']` が設定されていることが前提**（`amplify/backend.ts`）。
 * 設定が無いと、この関数を呼んだ瞬間に `email` 属性が新アドレスへ置き換わり
 * `email_verified` が false になるため、**ユーザーは旧アドレスでも新アドレスでも
 * ログインできなくなる**（＝アカウント喪失）。
 *
 * @see https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UpdateUserAttributes.html
 */
export async function changeEmail(newEmail: string): Promise<AuthResult> {
  if (!isValidEmail(newEmail)) {
    return { success: false, errorKey: 'emailInvalidFormat' }
  }

  try {
    await updateUserAttributes({
      userAttributes: { email: normalizeEmail(newEmail) },
    })
    return { success: true, successKey: 'emailChangeRequested' }
  } catch (error) {
    return toAuthFailure('changeEmail', error, { hideAccountExistence: true })
  }
}
