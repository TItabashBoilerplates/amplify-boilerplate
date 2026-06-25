/**
 * 認証アクション用共有フック（Web/Native 共通・Amplify Cognito / Email OTP）
 *
 * UI 非依存の認証操作を提供する。Web は `apps/web/features/auth` の Server-less
 * クライアント関数を、Mobile はこのフックを利用できる。
 */

import { confirmSignIn, signIn, signOut } from 'aws-amplify/auth'
import { useCallback, useState } from 'react'

/**
 * 認証アクションのステート
 */
export interface AuthActionState {
  isLoading: boolean
  error: string | null
}

type Result = { success: true; error: null } | { success: false; error: string }

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error occurred'
}

/**
 * 認証アクション用フック（プラットフォーム非依存）
 *
 * @example
 * ```tsx
 * const { state, requestOtp, confirmOtp, handleSignOut } = useAuthActions()
 *
 * await requestOtp('user@example.com')
 * await confirmOtp('123456') // メールで届いたコード
 * ```
 */
export function useAuthActions() {
  const [state, setState] = useState<AuthActionState>({
    isLoading: false,
    error: null,
  })

  const run = useCallback(async (fn: () => Promise<void>): Promise<Result> => {
    setState({ isLoading: true, error: null })
    try {
      await fn()
      setState({ isLoading: false, error: null })
      return { success: true, error: null }
    } catch (err) {
      const error = toMessage(err)
      setState({ isLoading: false, error })
      return { success: false, error }
    }
  }, [])

  /** メールに OTP を送信（サインイン開始） */
  const requestOtp = useCallback(
    (email: string) =>
      run(async () => {
        await signIn({
          username: email,
          options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
        })
      }),
    [run]
  )

  /** OTP コードを検証してサインイン完了 */
  const confirmOtp = useCallback(
    (code: string) =>
      run(async () => {
        await confirmSignIn({ challengeResponse: code })
      }),
    [run]
  )

  /**
   * OTP コードを再送信。
   * `USER_AUTH` フローには専用 resend API が無いため、`signIn` を再実行して新コードを送る。
   */
  const resendOtp = useCallback(
    (email: string) =>
      run(async () => {
        await signIn({
          username: email,
          options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
        })
      }),
    [run]
  )

  /** サインアウト */
  const handleSignOut = useCallback(() => run(async () => signOut()), [run])

  const resetError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
    requestOtp,
    confirmOtp,
    resendOtp,
    handleSignOut,
    resetError,
  }
}
