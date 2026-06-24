'use server'

import { createServerClient as createClient } from '@/shared/lib/supabase'

/**
 * パスワードレス認証：メールアドレスにOTPを送信
 *
 * @param email - ユーザーのメールアドレス
 * @param locale - ユーザーのロケール（'en' | 'ja'）- Emailテンプレートの言語切り替えに使用
 * @returns 成功時は success: true、失敗時はエラーメッセージ
 *
 * @example
 * ```tsx
 * 'use server'
 * import { signInWithOtp } from '@/features/auth'
 *
 * export async function handleLogin(formData: FormData) {
 *   const email = formData.get('email') as string
 *   const locale = formData.get('locale') as string
 *   const result = await signInWithOtp(email, locale)
 *
 *   if ('error' in result) {
 *     return { success: false, message: result.error }
 *   }
 *
 *   return { success: true, message: 'Check your email for OTP!' }
 * }
 * ```
 */
export async function signInWithOtp(email: string, locale: string = 'en') {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // パスワードレス認証のベストプラクティス: OTP受信で所有権を証明
        // Auth Hookで自動的にusersテーブルにユーザー情報を作成
        shouldCreateUser: true,
        // Emailテンプレートで多言語対応するためにlocaleを設定
        // テンプレート内で {{ .Data.locale }} として参照可能
        data: {
          locale,
        },
      },
    })

    if (error) {
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
