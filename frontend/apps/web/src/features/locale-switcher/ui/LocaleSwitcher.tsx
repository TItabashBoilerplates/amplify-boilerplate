import { useLocale, useTranslations } from 'next-intl'
import { routing } from '@/shared/config/i18n'
import LocaleSwitcherSelect from './LocaleSwitcherSelect'

/**
 * 言語切り替えコンポーネント（Server Component）
 *
 * ボタンベースの言語切り替えを提供
 * URLにロケールプレフィックスは表示されない
 *
 * @example
 * ```tsx
 * import { LocaleSwitcher } from '@/features/locale-switcher'
 *
 * export default function Layout({ children }) {
 *   return (
 *     <header>
 *       <LocaleSwitcher />
 *     </header>
 *   )
 * }
 * ```
 */
export default function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const locale = useLocale()

  return (
    <LocaleSwitcherSelect defaultValue={locale} label={t('label')}>
      {routing.locales.map((cur) => (
        <option key={cur} value={cur}>
          {t('locale', { locale: cur })}
        </option>
      ))}
    </LocaleSwitcherSelect>
  )
}
