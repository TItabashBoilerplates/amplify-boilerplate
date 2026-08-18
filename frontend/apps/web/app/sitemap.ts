import type { MetadataRoute } from 'next'
import { APP_URL } from '@/shared/config/app'
import { routing } from '@/shared/config/i18n'

/**
 * サイトマップ。ロケールごとのトップ URL を列挙する。
 * ルートが増えたらここに追加し、必要なら locale × path の直積で展開する。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return routing.locales.map((locale) => ({
    url: `${APP_URL}/${locale}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 1,
  }))
}
