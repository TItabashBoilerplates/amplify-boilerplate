import type { MetadataRoute } from 'next'
import { APP_URL } from '@/shared/config/app'

/**
 * robots.txt。API はクロール対象外にする。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
