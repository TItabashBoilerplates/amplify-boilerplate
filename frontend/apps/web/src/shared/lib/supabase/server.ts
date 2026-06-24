import { createServerClient } from '@supabase/ssr'
import type { Database } from '@workspace/types/schema'
import { cookies } from 'next/headers'

/**
 * Server Components/Actions/Route Handlers用Supabaseクライアント
 *
 * Next.js 15対応: cookies()は非同期関数のためawaitが必要
 *
 * @returns サーバー環境で動作するSupabaseクライアント
 *
 * @example
 * ```typescript
 * // Server Component
 * import { createServerClient } from '@/shared/lib/supabase'
 * import { redirect } from 'next/navigation'
 *
 * export default async function Page() {
 *   const supabase = await createServerClient()
 *   const { data: { user } } = await supabase.auth.getUser() // セキュア
 *
 *   if (!user) redirect('/login')
 *   return <div>Hello, {user.email}</div>
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Server Action
 * 'use server'
 * import { createServerClient } from '@/shared/lib/supabase'
 * import { revalidatePath } from 'next/cache'
 *
 * export async function updateProfile(formData: FormData) {
 *   const supabase = await createServerClient()
 *   const { error } = await supabase
 *     .from('profiles')
 *     .update({ name: formData.get('name') })
 *
 *   if (!error) revalidatePath('/profile')
 * }
 * ```
 */
export async function createClient() {
  // Next.js 15: cookies()は非同期関数
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server ComponentからのCookie書き込みエラーは
          // Middlewareがセッション更新を担当するため安全に無視
        }
      },
    },
  })
}
