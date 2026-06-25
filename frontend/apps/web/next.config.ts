import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/shared/config/i18n/request.ts')

/**
 * 本番デフォルトのセキュリティヘッダ（全ルートに付与）。
 * 静的最適化を壊さないため、nonce ベースの CSP（動的レンダリング強制）は既定にせず、
 * 静的ヘッダのみを既定とする。厳格な CSP が必要な場合は `middleware`（Next.js 16 は `proxy`）で
 * nonce CSP を足す（AppSync の wss / Cognito / S3 / Lambda Function URL を connect-src に許可）。
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
 * @see https://nextjs.org/docs/app/guides/content-security-policy
 */
const securityHeaders = [
  // HTTPS を強制（プリロード対象）
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // クリックジャッキング防止（CSP frame-ancestors の後方互換）
  { key: 'X-Frame-Options', value: 'DENY' },
  // MIME スニッフィング防止
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // リファラ送出を最小化
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 不要なブラウザ機能を無効化
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

const nextConfig: NextConfig = {
  // X-Powered-By を出さない（実装の露出を避ける）
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
