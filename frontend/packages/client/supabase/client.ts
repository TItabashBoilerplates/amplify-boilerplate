import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@workspace/types/schema'

/**
 * Client Components用Supabaseクライアント
 *
 * @returns ブラウザ環境で動作するSupabaseクライアント
 *
 * @example
 * ```typescript
 * 'use client'
 * import { createClient } from '@workspace/client-supabase/client'
 *
 * export function UserProfile() {
 *   const supabase = createClient()
 *   // クライアント側ではgetSession()が許容される
 *   const { data: { session } } = await supabase.auth.getSession()
 *   return <div>{session?.user.email}</div>
 * }
 * ```
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)
}
