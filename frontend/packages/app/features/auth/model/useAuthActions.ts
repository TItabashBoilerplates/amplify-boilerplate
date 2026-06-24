/**
 * 認証アクション用共有フック
 *
 * Web/Native間で共有される認証操作
 */

import { useCallback, useState } from 'react'

/**
 * 認証アクションのステート
 */
export interface AuthActionState {
  isLoading: boolean
  error: string | null
}

/**
 * サインイン用の認証情報
 */
export interface SignInCredentials {
  email: string
  password: string
}

/**
 * サインアップ用の認証情報
 */
export interface SignUpCredentials {
  email: string
  password: string
  displayName?: string
}

/**
 * 認証アクション用フック（プラットフォーム非依存のロジック）
 *
 * @example
 * ```tsx
 * const { state, handleSignIn, handleSignOut, resetError } = useAuthActions(supabase)
 *
 * const onSubmit = async (data: SignInCredentials) => {
 *   const result = await handleSignIn(data)
 *   if (result.success) {
 *     // Navigate to home
 *   }
 * }
 * ```
 */
export function useAuthActions(supabase: {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: { user: unknown } | null
      error: Error | null
    }>
    signUp: (credentials: {
      email: string
      password: string
      options?: { data?: Record<string, unknown> }
    }) => Promise<{
      data: { user: unknown } | null
      error: Error | null
    }>
    signOut: () => Promise<{ error: Error | null }>
  }
}) {
  const [state, setState] = useState<AuthActionState>({
    isLoading: false,
    error: null,
  })

  const handleSignIn = useCallback(
    async (credentials: SignInCredentials) => {
      setState({ isLoading: true, error: null })

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })

        if (error) {
          setState({ isLoading: false, error: error.message })
          return { success: false, error: error.message }
        }

        setState({ isLoading: false, error: null })
        return { success: true, error: null }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setState({ isLoading: false, error: errorMessage })
        return { success: false, error: errorMessage }
      }
    },
    [supabase.auth]
  )

  const handleSignUp = useCallback(
    async (credentials: SignUpCredentials) => {
      setState({ isLoading: true, error: null })

      try {
        const { error } = await supabase.auth.signUp({
          email: credentials.email,
          password: credentials.password,
          options: credentials.displayName
            ? { data: { display_name: credentials.displayName } }
            : undefined,
        })

        if (error) {
          setState({ isLoading: false, error: error.message })
          return { success: false, error: error.message }
        }

        setState({ isLoading: false, error: null })
        return { success: true, error: null }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setState({ isLoading: false, error: errorMessage })
        return { success: false, error: errorMessage }
      }
    },
    [supabase.auth]
  )

  const handleSignOut = useCallback(async () => {
    setState({ isLoading: true, error: null })

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        setState({ isLoading: false, error: error.message })
        return { success: false, error: error.message }
      }

      setState({ isLoading: false, error: null })
      return { success: true, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setState({ isLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }, [supabase.auth])

  const resetError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    resetError,
  }
}
