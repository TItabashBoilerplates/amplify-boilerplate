import { describe, expect, it } from 'vitest'
import { AUTH_ERROR_MESSAGE_KEYS, resolveAuthError } from './errors'

/**
 * Cognito の例外を **安定した i18n キー**へ落とす層のテスト。
 *
 * ここが壊れると、ユーザーには「エラーが発生しました」しか出ない状態になり、
 * 何をすれば復帰できるのかが分からなくなる（＝サポート問い合わせ行き）。
 */
describe('resolveAuthError', () => {
  it('null / undefined を渡したら null（エラー無しを誤ってエラー表示しない）', () => {
    expect(resolveAuthError(null)).toBeNull()
    expect(resolveAuthError(undefined)).toBeNull()
  })

  it.each([
    ['NotAuthorizedException', 'invalidCredentials'],
    ['UserNotConfirmedException', 'emailNotConfirmed'],
    ['InvalidPasswordException', 'weakPassword'],
    ['PasswordHistoryPolicyViolationException', 'samePassword'],
    ['CodeMismatchException', 'codeMismatch'],
    ['ExpiredCodeException', 'codeExpired'],
    ['CodeDeliveryFailureException', 'codeDeliveryFailed'],
    ['UsernameExistsException', 'emailExists'],
    ['AliasExistsException', 'emailExists'],
    ['UserNotFoundException', 'userNotFound'],
    ['PasswordResetRequiredException', 'passwordResetRequired'],
    ['InvalidParameterException', 'validationFailed'],
    ['ForbiddenException', 'forbidden'],
  ])('%s → %s', (name, key) => {
    expect(resolveAuthError({ name, message: 'ignored' })?.messageKey).toBe(key)
  })

  it.each([
    'LimitExceededException',
    'TooManyRequestsException',
    'TooManyFailedAttemptsException',
  ])('レート制限系は rateLimited に集約する: %s', (name) => {
    expect(resolveAuthError({ name, message: '' })?.messageKey).toBe('rateLimited')
  })

  it('未知の例外は unexpected にフォールバックしつつ原文を保持する（ログ用）', () => {
    const resolved = resolveAuthError({ name: 'SomeBrandNewException', message: 'boom' })
    expect(resolved?.messageKey).toBe('unexpected')
    expect(resolved?.name).toBe('SomeBrandNewException')
    expect(resolved?.raw).toBe('boom')
  })

  it('name が無いエラーでも落ちない', () => {
    expect(resolveAuthError(new Error('plain'))?.messageKey).toBe('unexpected')
  })

  describe('requiresPasswordReset', () => {
    it('PasswordResetRequiredException のときだけ true', () => {
      expect(
        resolveAuthError({ name: 'PasswordResetRequiredException' })?.requiresPasswordReset
      ).toBe(true)
      expect(resolveAuthError({ name: 'NotAuthorizedException' })?.requiresPasswordReset).toBe(
        false
      )
    })
  })

  describe('requiresConfirmation', () => {
    it('UserNotConfirmedException のときだけ true（確認コード画面へ送る）', () => {
      expect(resolveAuthError({ name: 'UserNotConfirmedException' })?.requiresConfirmation).toBe(
        true
      )
      expect(resolveAuthError({ name: 'NotAuthorizedException' })?.requiresConfirmation).toBe(false)
    })
  })

  describe('revealsAccountExistence', () => {
    it.each([
      'UsernameExistsException',
      'AliasExistsException',
      'UserNotFoundException',
    ])('%s はアカウントの存在を暴露しうる（画面に出してはならない）', (name) => {
      expect(resolveAuthError({ name })?.revealsAccountExistence).toBe(true)
    })

    it('資格情報エラーは暴露しない（PreventUserExistenceErrors の想定どおり）', () => {
      expect(resolveAuthError({ name: 'NotAuthorizedException' })?.revealsAccountExistence).toBe(
        false
      )
    })
  })

  it('すべてのマッピング先が AUTH_ERROR_MESSAGE_KEYS に含まれる（翻訳漏れを防ぐ）', () => {
    const names = [
      'NotAuthorizedException',
      'UserNotConfirmedException',
      'InvalidPasswordException',
      'CodeMismatchException',
      'ExpiredCodeException',
      'LimitExceededException',
      'UsernameExistsException',
      'UserNotFoundException',
      'PasswordResetRequiredException',
      'ForbiddenException',
      'ThisDoesNotExist',
    ]
    for (const name of names) {
      const key = resolveAuthError({ name })?.messageKey
      expect(AUTH_ERROR_MESSAGE_KEYS).toContain(key)
    }
  })
})
