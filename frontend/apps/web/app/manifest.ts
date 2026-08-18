import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/shared/config/app'

/**
 * PWA manifest。単一ファイルのため i18n はせずデフォルト言語の名称を使う。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'A full-stack Next.js + AWS Amplify Gen2 boilerplate.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [{ src: '/icon', sizes: '32x32', type: 'image/png' }],
  }
}
