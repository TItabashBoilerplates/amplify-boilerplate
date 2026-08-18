import type { AuthErrorKey, AuthResult } from '@workspace/auth/api'
import type { AuthSuccessKey } from '@workspace/auth/validation'

/**
 * Storybook 用のスタブ。
 *
 * 実 API は Amplify の設定（`amplify_outputs.json`）を要求し、カタログでは読めない。
 * フォームが送信処理を props で受け取る設計なのはこのため。
 */
export const idleResult = async (): Promise<AuthResult> => ({
  success: false,
  errorKey: 'unexpected',
})

/** 解決しない Promise。送信中の見た目を確認する用 */
export const pendingResult = (): Promise<AuthResult> => new Promise(() => {})

export const successResult = (successKey: AuthSuccessKey) => async (): Promise<AuthResult> => ({
  success: true,
  successKey,
})

export const errorResult =
  (errorKey: AuthErrorKey, requiresPasswordReset = false) =>
  async (): Promise<AuthResult> => ({ success: false, errorKey, requiresPasswordReset })
