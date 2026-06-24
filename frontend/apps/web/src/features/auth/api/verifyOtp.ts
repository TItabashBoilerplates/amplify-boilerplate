'use server'

import { redirect } from 'next/navigation'
import { createServerClient as createClient } from '@/shared/lib/supabase'

/**
 * OTPトークンを検証してログイン
 *
 * @param email - ユーザーのメールアドレス
 * @param token - 6桁のOTPトークン
 * @returns 成功時はリダイレクト、失敗時はエラーメッセージ
 *
 * @example
 * ```tsx
 * 'use server'
 * import { verifyOtp } from '@/features/auth'
 *
 * export async function handleVerifyOtp(formData: FormData) {
 *   const email = formData.get('email') as string
 *   const token = formData.get('token') as string
 *
 *   const result = await verifyOtp(email, token)
 *
 *   if ('error' in result) {
 *     return { success: false, message: result.error }
 *   }
 *
 *   // 成功時はリダイレクトされる
 * }
 * ```
 */
export async function verifyOtp(email: string, token: string) {
  try {
    const supabase = await createClient()

    const {
      data: { session },
      error,
    } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return { error: error.message }
    }

    if (!session) {
      return { error: 'Failed to create session' }
    }

    // 認証成功後、ダッシュボードにリダイレクト
    redirect('/dashboard')
  } catch (error) {
    if (error instanceof Error) {
      // Next.js の redirect は Error をスローするため、
      // redirect の場合は再スローする
      if (error.message === 'NEXT_REDIRECT') {
        throw error
      }
      return { error: error.message }
    }
    return { error: 'An unexpected error occurred' }
  }
}
