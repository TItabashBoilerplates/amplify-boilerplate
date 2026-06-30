import { redirect } from 'next/navigation'
import { routing } from '@/shared/config/i18n'

/**
 * ルートページ
 *
 * `localePrefix: 'always'` のため、ロケール無しの `/` は単体の有効ルートではない。
 * デフォルトロケール配下（例: `/en`）へリダイレクトする。実体は `app/[locale]` で描画する。
 * （ルート直下にはアプリのプロバイダ/intl コンテキストが無いため、ここでページを描画しない）
 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`)
}
