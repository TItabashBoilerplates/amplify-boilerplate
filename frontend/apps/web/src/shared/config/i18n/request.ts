import { getRequestConfig } from 'next-intl/server'
import { routing } from '@/shared/config/i18n'

/**
 * next-intl のリクエストごとの設定
 * Feature Sliced Design の shared/config/i18n レイヤーに配置
 *
 * Server Components や Server Actions で使用される
 * リクエストごとに一度だけ実行される
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // リクエストから locale を取得
  // middleware で設定されたロケールを使用
  let locale = await requestLocale

  // locale が定義されていない場合、または有効なロケールでない場合はデフォルトを使用
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    // 翻訳メッセージを動的にインポート
    messages: (await import(`@/shared/config/i18n/messages/${locale}.json`)).default,
  }
})
