import { createServerClient } from '@supabase/ssr'
import type { Database } from '@workspace/types/schema'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware用セッション更新関数
 *
 * すべてのリクエストでSupabaseセッショントークンをリフレッシュし、
 * 更新されたトークンをServer Componentsとブラウザの両方に渡します。
 *
 * @param request - Next.jsのリクエストオブジェクト
 * @param response - Next.jsのレスポンスオブジェクト（next-intl等の他のmiddlewareから渡される）
 * @returns 更新されたCookieを含むレスポンス
 *
 * @example
 * ```typescript
 * // proxy.ts (Next.js 16+)
 * import createMiddleware from 'next-intl/middleware'
 * import { type NextRequest } from 'next/server'
 * import { routing } from './src/shared/config/i18n'
 * import { updateSession } from '@/shared/lib/supabase'
 *
 * const handleI18nRouting = createMiddleware(routing)
 *
 * export default async function middleware(request: NextRequest) {
 *   // Step 1: next-intlのルーティング処理
 *   const response = handleI18nRouting(request)
 *
 *   // Step 2: Supabaseセッション更新（レスポンスを渡す）
 *   return await updateSession(request, response)
 * }
 *
 * export const config = {
 *   matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
 * }
 * ```
 *
 * @remarks
 * この関数は以下の責務を持ちます：
 * 1. Authトークンを `supabase.auth.getUser()` でリフレッシュ
 * 2. リフレッシュされたトークンを `request.cookies.set` でServer Componentsに渡す
 * 3. リフレッシュされたトークンを `response.cookies.set` でブラウザに渡す
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // リクエストにCookieを設定（Server Componentsで利用可能に）
          request.cookies.set(name, value)
          // レスポンスにCookieを設定（ブラウザへ送信）
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // 重要: セッショントークンをリフレッシュ
  // getUser()を使用してトークンの真正性を検証
  await supabase.auth.getUser()

  return response
}
