import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@workspace/types/schema'

/**
 * React Native (Expo) 用 Supabase クライアント
 *
 * AsyncStorageを使用してセッションを永続化
 *
 * @returns React Native環境で動作するSupabaseクライアント
 *
 * @example
 * ```typescript
 * import { createClient } from '@workspace/client-supabase/native'
 *
 * const supabase = createClient()
 *
 * // 認証
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password'
 * })
 *
 * // データ取得
 * const { data: users } = await supabase.from('users').select('*')
 * ```
 */
export function createClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  return createSupabaseClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native では URL 検出を無効化
      detectSessionInUrl: false,
    },
  })
}

/**
 * シングルトン Supabase クライアント
 *
 * アプリ全体で1つのインスタンスを共有する場合に使用
 */
let supabaseInstance: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient()
  }
  return supabaseInstance
}
