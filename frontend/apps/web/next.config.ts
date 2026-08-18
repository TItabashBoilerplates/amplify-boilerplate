import { IMAGE_WIDTH_LADDER } from '@workspace/storage-image'
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

/**
 * `next/image` が生成しうる幅を `@workspace/storage-image` の段と**完全に一致**させる。
 *
 * ここがズレると、`StorageImage` が要求する派生（`...@128w.jpg`）と Next が
 * 生成する srcset の幅が食い違い、**Mobile 側だけ 404**になる
 * （`.claude/rules/storage-images.md` §2。`storage-image.policy.test.ts` が検査する）。
 *
 * Next.js は `deviceSizes`（viewport 基準、`sizes` 指定時に使う）と
 * `imageSizes`（`sizes` 未指定時の固定幅）を分けて持つので、段を 2 つに割って渡す。
 */
const SIZE_SPLIT = 640
const imageSizes = IMAGE_WIDTH_LADDER.filter((width) => width < SIZE_SPLIT)
const deviceSizes = IMAGE_WIDTH_LADDER.filter((width) => width >= SIZE_SPLIT)

const nextConfig: NextConfig = {
  // X-Powered-By を出さない（実装の露出を避ける）
  poweredByHeader: false,
  images: {
    imageSizes: [...imageSizes],
    deviceSizes: [...deviceSizes],
    /**
     * S3 / CloudFront のホストを登録しないと `next/image` が 400 で落ちる。
     * バケット名・ディストリビューションは環境ごとに変わるので、
     * `amplify_outputs.json` から来る値ではなく**ホスト名のパターン**で許可する。
     */
    remotePatterns: [
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
