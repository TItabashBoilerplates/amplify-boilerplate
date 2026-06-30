import createMiddleware from 'next-intl/middleware'
import { routing } from '@/shared/config/i18n'

/**
 * next-intl のミドルウェア（Next.js 16 では `middleware` の後継として `proxy` を使用）。
 *
 * ロケール検出を行い、`x-next-intl-locale` を付与してリクエストに伝播させる。これにより
 * Server Components の `getTranslations` / `getMessages` が URL のロケールを解決できる
 * （これが無いと `request.ts` の `requestLocale` が空になり、常に defaultLocale にフォールバックして
 * `/ja` でも本文が英語になる）。`localePrefix: 'always'` のため `/` は既定ロケールへリダイレクトされる。
 *
 * @see https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
 */
export default createMiddleware(routing)

export const config = {
  // api / _next / _vercel と、ドット付き（静的ファイル）を除く全パスにマッチ
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
