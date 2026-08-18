import { resendSignUpCode } from 'aws-amplify/auth'
import { normalizeEmail } from '../validation'
import { toAuthFailure } from './authResult'
import type { AuthResult } from './types'

/**
 * サインアップ確認コードを再送する（Cognito）。
 *
 * 未確認ユーザーが「コードが届かない / 期限切れ」で詰まるのを防ぐ導線。
 * アカウントの存在を漏らさないよう、失敗時も専用の文言を出さない。
 */
export async function resendSignUpConfirmation(email: string): Promise<AuthResult> {
  try {
    await resendSignUpCode({ username: normalizeEmail(email) })
    return { success: true, successKey: 'signUpConfirmationSent' }
  } catch (error) {
    return toAuthFailure('resendSignUpConfirmation', error, { hideAccountExistence: true })
  }
}
