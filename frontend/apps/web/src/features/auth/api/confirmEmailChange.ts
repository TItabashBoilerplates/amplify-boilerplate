import { confirmUserAttribute } from 'aws-amplify/auth'
import { toAuthFailure } from '../lib/authResult'
import type { AuthResult } from '../model/types'

/**
 * 新しいメールアドレスに届いたコードで変更を確定する（Cognito）。
 *
 * **ここが通るまでメールアドレスは変わっていない**（`AttributesRequireVerificationBeforeUpdate`
 * により旧アドレスが有効なまま保たれる）。Amplify Data 側にメールアドレスを
 * 複製している場合は、**この成功後に**同期する（`.claude/rules/auth.md` §3.4）。
 */
export async function confirmEmailChange(code: string): Promise<AuthResult> {
  if (code.trim().length === 0) {
    return { success: false, errorKey: 'codeRequired' }
  }

  try {
    await confirmUserAttribute({
      userAttributeKey: 'email',
      confirmationCode: code.trim(),
    })
    return { success: true, successKey: 'emailChanged' }
  } catch (error) {
    return toAuthFailure('confirmEmailChange', error)
  }
}
