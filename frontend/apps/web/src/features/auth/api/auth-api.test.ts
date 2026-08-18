import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `features/auth/api/*` の単体テスト（`.claude/rules/tdd.md`）。
 *
 * ここで守っているのは主に **3 つの事故**:
 *
 * 1. `nextStep` を分岐せず「ログインに失敗しました」で片付けてしまう
 *    （未確認ユーザー・要リセットのユーザーが画面で行き止まりになる）
 * 2. Cognito の英語メッセージをそのまま画面に出してしまう（i18n 違反）
 * 3. アカウントの存在を暴露するエラーをそのまま返してしまう（ユーザー列挙）
 */

const amplifyAuth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  confirmSignUp: vi.fn(),
  confirmSignIn: vi.fn(),
  autoSignIn: vi.fn(),
  resendSignUpCode: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  updatePassword: vi.fn(),
  updateUserAttributes: vi.fn(),
  confirmUserAttribute: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('aws-amplify/auth', () => amplifyAuth)

import { changeEmail } from './changeEmail'
import { changePassword } from './changePassword'
import { confirmEmailChange } from './confirmEmailChange'
import { confirmPasswordReset } from './confirmPasswordReset'
import { confirmSignUpCode } from './confirmSignUpCode'
import { deleteAccount } from './deleteAccount'
import { requestPasswordReset } from './requestPasswordReset'
import { signInWithOtp } from './signInWithOtp'
import { signInWithPassword } from './signInWithPassword'
import { signUpWithPassword } from './signUpWithPassword'
import { verifyOtp } from './verifyOtp'

const STRONG = 'Str0ng-Passw0rd!'

/** Cognito が投げる例外を模す（`name` だけが安定した識別子） */
function cognitoError(name: string): Error {
  const error = new Error(`${name}: implementation detail in English`)
  error.name = name
  return error
}

beforeEach(() => {
  vi.clearAllMocks()
  // 原文はログに出す設計なので、テスト出力を汚さないよう黙らせる
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('signUpWithPassword', () => {
  it('メール形式を送信前に弾く', async () => {
    const result = await signUpWithPassword('not-an-email', STRONG)
    expect(result).toEqual({ success: false, errorKey: 'emailInvalidFormat' })
    expect(amplifyAuth.signUp).not.toHaveBeenCalled()
  })

  it('ポリシーを満たさないパスワードを送信前に弾く', async () => {
    const result = await signUpWithPassword('user@example.com', 'weak')
    expect(result).toEqual({ success: false, errorKey: 'passwordTooWeak' })
    expect(amplifyAuth.signUp).not.toHaveBeenCalled()
  })

  it('メールアドレスを正規化して渡す', async () => {
    amplifyAuth.signUp.mockResolvedValue({ nextStep: { signUpStep: 'CONFIRM_SIGN_UP' } })
    await signUpWithPassword('  User@Example.COM ', STRONG)
    expect(amplifyAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'user@example.com' })
    )
  })

  it('CONFIRM_SIGN_UP は確認コード画面へ送る', async () => {
    amplifyAuth.signUp.mockResolvedValue({ nextStep: { signUpStep: 'CONFIRM_SIGN_UP' } })
    const result = await signUpWithPassword('user@example.com', STRONG)
    expect(result).toEqual({
      success: true,
      successKey: 'signUpConfirmationSent',
      nextStep: 'confirm',
    })
  })

  it('COMPLETE_AUTO_SIGN_IN は autoSignIn を呼んでサインインまで進む', async () => {
    amplifyAuth.signUp.mockResolvedValue({ nextStep: { signUpStep: 'COMPLETE_AUTO_SIGN_IN' } })
    amplifyAuth.autoSignIn.mockResolvedValue({ isSignedIn: true })
    const result = await signUpWithPassword('user@example.com', STRONG)
    expect(amplifyAuth.autoSignIn).toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, nextStep: 'signedIn' })
  })

  /** 登録済みかどうかを教えるとユーザー列挙の入口になる */
  it('UsernameExistsException を専用の文言で返さない', async () => {
    amplifyAuth.signUp.mockRejectedValue(cognitoError('UsernameExistsException'))
    const result = await signUpWithPassword('user@example.com', STRONG)
    expect(result).toEqual({ success: false, errorKey: 'unexpected' })
  })
})

describe('signInWithPassword', () => {
  it('サインイン成功', async () => {
    amplifyAuth.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } })
    const result = await signInWithPassword('user@example.com', STRONG)
    expect(result).toEqual({ success: true, successKey: 'signedIn', nextStep: 'signedIn' })
  })

  it('パスワード未入力を送信前に弾く', async () => {
    const result = await signInWithPassword('user@example.com', '')
    expect(result).toEqual({ success: false, errorKey: 'passwordRequired' })
    expect(amplifyAuth.signIn).not.toHaveBeenCalled()
  })

  /**
   * ここを握りつぶすと、未確認ユーザーが「パスワードが違います」と言われ続けて
   * 永久に確認できない。
   */
  it('CONFIRM_SIGN_UP は確認コード画面へ誘導する', async () => {
    amplifyAuth.signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_UP' },
    })
    const result = await signInWithPassword('user@example.com', STRONG)
    expect(result).toEqual({
      success: false,
      errorKey: 'emailNotConfirmed',
      requiresConfirmation: true,
    })
  })

  /** ここを握りつぶすとログイン画面が行き止まりになる */
  it('RESET_PASSWORD は再設定導線へ誘導する', async () => {
    amplifyAuth.signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'RESET_PASSWORD' },
    })
    const result = await signInWithPassword('user@example.com', STRONG)
    expect(result).toEqual({
      success: false,
      errorKey: 'passwordResetRequired',
      requiresPasswordReset: true,
    })
  })

  it('例外は i18n キーへ落とし、英語の原文を返さない', async () => {
    amplifyAuth.signIn.mockRejectedValue(cognitoError('NotAuthorizedException'))
    const result = await signInWithPassword('user@example.com', STRONG)
    expect(result).toMatchObject({ success: false, errorKey: 'invalidCredentials' })
    expect(JSON.stringify(result)).not.toContain('implementation detail')
  })

  it('PasswordResetRequiredException も再設定導線へ繋ぐ', async () => {
    amplifyAuth.signIn.mockRejectedValue(cognitoError('PasswordResetRequiredException'))
    const result = await signInWithPassword('user@example.com', STRONG)
    expect(result).toMatchObject({ requiresPasswordReset: true })
  })
})

describe('confirmSignUpCode', () => {
  it('コード未入力を弾く', async () => {
    expect(await confirmSignUpCode('user@example.com', '  ')).toEqual({
      success: false,
      errorKey: 'codeRequired',
    })
  })

  it('確認後に autoSignIn まで進む', async () => {
    amplifyAuth.confirmSignUp.mockResolvedValue({
      nextStep: { signUpStep: 'COMPLETE_AUTO_SIGN_IN' },
    })
    amplifyAuth.autoSignIn.mockResolvedValue({ isSignedIn: true })
    expect(await confirmSignUpCode('user@example.com', '123456')).toEqual({
      success: true,
      successKey: 'signedIn',
    })
  })

  it('コード誤りは codeMismatch', async () => {
    amplifyAuth.confirmSignUp.mockRejectedValue(cognitoError('CodeMismatchException'))
    expect(await confirmSignUpCode('user@example.com', '000000')).toMatchObject({
      errorKey: 'codeMismatch',
    })
  })
})

describe('requestPasswordReset', () => {
  it('コードを送る', async () => {
    amplifyAuth.resetPassword.mockResolvedValue({
      nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' },
    })
    expect(await requestPasswordReset('user@example.com')).toEqual({
      success: true,
      successKey: 'passwordResetCodeSent',
    })
  })

  /** 未登録アドレスを教えるとユーザー列挙の入口になる */
  it('UserNotFoundException を専用の文言で返さない', async () => {
    amplifyAuth.resetPassword.mockRejectedValue(cognitoError('UserNotFoundException'))
    expect(await requestPasswordReset('user@example.com')).toEqual({
      success: false,
      errorKey: 'unexpected',
    })
  })
})

describe('confirmPasswordReset', () => {
  it('弱いパスワードを送信前に弾く', async () => {
    expect(await confirmPasswordReset('user@example.com', '123456', 'weak')).toEqual({
      success: false,
      errorKey: 'passwordTooWeak',
    })
    expect(amplifyAuth.confirmResetPassword).not.toHaveBeenCalled()
  })

  it('コードと新パスワードで確定する', async () => {
    amplifyAuth.confirmResetPassword.mockResolvedValue(undefined)
    expect(await confirmPasswordReset('user@example.com', ' 123456 ', STRONG)).toEqual({
      success: true,
      successKey: 'passwordUpdated',
    })
    expect(amplifyAuth.confirmResetPassword).toHaveBeenCalledWith({
      username: 'user@example.com',
      confirmationCode: '123456',
      newPassword: STRONG,
    })
  })

  it('期限切れコードは codeExpired', async () => {
    amplifyAuth.confirmResetPassword.mockRejectedValue(cognitoError('ExpiredCodeException'))
    expect(await confirmPasswordReset('user@example.com', '123456', STRONG)).toMatchObject({
      errorKey: 'codeExpired',
    })
  })
})

describe('changePassword', () => {
  it('現在のパスワード未入力を弾く', async () => {
    expect(await changePassword('', STRONG)).toEqual({
      success: false,
      errorKey: 'currentPasswordRequired',
    })
  })

  /**
   * 現在のパスワードの検証は Cognito に任せる。`signIn` での代用は
   * 新セッション発行の副作用があり誤り（`.claude/rules/auth.md` §3.3）。
   */
  it('updatePassword に委譲し、signIn を検証目的で呼ばない', async () => {
    amplifyAuth.updatePassword.mockResolvedValue(undefined)
    await changePassword('OldPassw0rd!x', STRONG)
    expect(amplifyAuth.updatePassword).toHaveBeenCalledWith({
      oldPassword: 'OldPassw0rd!x',
      newPassword: STRONG,
    })
    expect(amplifyAuth.signIn).not.toHaveBeenCalled()
  })

  it('現在のパスワード誤りは invalidCredentials', async () => {
    amplifyAuth.updatePassword.mockRejectedValue(cognitoError('NotAuthorizedException'))
    expect(await changePassword('wrong', STRONG)).toMatchObject({
      errorKey: 'invalidCredentials',
    })
  })
})

describe('changeEmail / confirmEmailChange', () => {
  it('不正なアドレスを送信前に弾く', async () => {
    expect(await changeEmail('nope')).toEqual({ success: false, errorKey: 'emailInvalidFormat' })
    expect(amplifyAuth.updateUserAttributes).not.toHaveBeenCalled()
  })

  it('正規化したアドレスで変更を申請する', async () => {
    amplifyAuth.updateUserAttributes.mockResolvedValue({
      email: { nextStep: { updateAttributeStep: 'CONFIRM_ATTRIBUTE_WITH_CODE' } },
    })
    expect(await changeEmail(' New@Example.COM ')).toEqual({
      success: true,
      successKey: 'emailChangeRequested',
    })
    expect(amplifyAuth.updateUserAttributes).toHaveBeenCalledWith({
      userAttributes: { email: 'new@example.com' },
    })
  })

  it('確定はコードを trim して渡す', async () => {
    amplifyAuth.confirmUserAttribute.mockResolvedValue(undefined)
    expect(await confirmEmailChange(' 123456 ')).toEqual({
      success: true,
      successKey: 'emailChanged',
    })
    expect(amplifyAuth.confirmUserAttribute).toHaveBeenCalledWith({
      userAttributeKey: 'email',
      confirmationCode: '123456',
    })
  })

  it('他人が使用中のアドレスは存在を暴露しない', async () => {
    amplifyAuth.updateUserAttributes.mockRejectedValue(cognitoError('AliasExistsException'))
    expect(await changeEmail('taken@example.com')).toEqual({
      success: false,
      errorKey: 'unexpected',
    })
  })
})

describe('deleteAccount', () => {
  it('削除に成功する', async () => {
    amplifyAuth.deleteUser.mockResolvedValue(undefined)
    expect(await deleteAccount()).toEqual({ success: true, successKey: 'accountDeleted' })
  })

  it('失敗を成功として偽装しない', async () => {
    amplifyAuth.deleteUser.mockRejectedValue(cognitoError('NotAuthorizedException'))
    expect(await deleteAccount()).toMatchObject({ success: false })
  })
})

describe('OTP フロー', () => {
  it('signInWithOtp は EMAIL_OTP チャレンジを要求する', async () => {
    amplifyAuth.signIn.mockResolvedValue({ nextStep: {} })
    await signInWithOtp('user@example.com')
    expect(amplifyAuth.signIn).toHaveBeenCalledWith({
      username: 'user@example.com',
      options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
    })
  })

  it('verifyOtp は未サインインを成功として扱わない', async () => {
    amplifyAuth.confirmSignIn.mockResolvedValue({ isSignedIn: false })
    expect(await verifyOtp('123456')).toEqual({ success: false, errorKey: 'codeMismatch' })
  })

  it('verifyOtp は空コードを弾く', async () => {
    expect(await verifyOtp('   ')).toEqual({ success: false, errorKey: 'codeRequired' })
    expect(amplifyAuth.confirmSignIn).not.toHaveBeenCalled()
  })
})

describe('エラーは必ずログに残す（握りつぶさない）', () => {
  it('catch した例外を console.error に出す', async () => {
    amplifyAuth.signIn.mockRejectedValue(cognitoError('InternalErrorException'))
    await signInWithPassword('user@example.com', STRONG)
    expect(console.error).toHaveBeenCalled()
  })
})
