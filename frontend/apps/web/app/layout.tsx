import type { Metadata } from 'next'
import { APP_NAME, APP_URL } from '@/shared/config/app'

/**
 * ルートレイアウト
 * next-intl を使用する場合、このファイルは最小限にする
 * 実際のレイアウトは [locale]/layout.tsx に配置
 *
 * `metadataBase` はここにも要る。**`/_not-found` はこのレイアウトの配下**で、
 * `[locale]/layout.tsx` の `generateMetadata` を通らないため、
 * 無いとビルド時に「metadataBase が未設定」警告が出て OG 画像が相対 URL になる。
 */
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
