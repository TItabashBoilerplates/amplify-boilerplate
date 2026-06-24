'use server'

import { createServerClient as createClient } from '@/shared/lib/supabase'

/**
 * OTPを再送信
 *
 * レート制限: 60秒に1回のみ送信可能
 *
 * @param email - ユーザーのメールアドレス
 * @returns 成功時は success: true、失敗時はエラーメッセージ
 *
 * @example
 * ```tsx
 * 'use server'
 * import { resendOtp } from '@/features/auth'
 *
 * export async function handleResendOtp(email: string) {
 *   const result = await resendOtp(email)
 *
 *   if ('error' in result) {
 *     return { success: false, message: result.error }
 *   }
 *
 *   return { success: true, message: 'OTP resent successfully' }
 * }
 * ```
 */
export async function resendOtp(email: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      // レート制限エラーの場合
      if (error.message.includes('rate limit')) {
        return { error: 'Please wait 60 seconds before requesting a new code' }
      }
      return { error: error.message }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'An unexpected error occurred' }
  }
}
