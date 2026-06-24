import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { updateSession } from '@/shared/lib/supabase'
import { routing } from './src/shared/config/i18n'

/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * 統合機能:
 * 1. next-intl: ロケールベースのルーティング（i18n）
 * 2. Supabase: セッショントークンのリフレッシュ
 *
 * 処理順序:
 * - まず next-intl でルーティング処理
 * - 次に Supabase でセッション更新
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */
const handleI18nRouting = createMiddleware(routing)

export default async function proxy(request: NextRequest) {
  // Step 1: next-intl のルーティング処理
  const response = handleI18nRouting(request)

  // Step 2: Supabase セッション更新（レスポンスを渡す）
  return await updateSession(request, response)
}

export const config = {
  // 以下のパスを除くすべてのパス名にマッチ:
  // - /api で始まるもの
  // - /_next で始まるもの（Next.js の内部ファイル）
  // - /_vercel で始まるもの（Vercel の内部ファイル）
  // - ドットを含むもの（静的ファイル: favicon.ico など）
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
