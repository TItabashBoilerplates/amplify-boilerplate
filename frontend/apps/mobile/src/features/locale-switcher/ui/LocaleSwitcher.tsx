import { Button, ButtonText, HStack } from '@workspace/native-ui/components'

import { type Locale, supportedLocales } from '@/shared/config/i18n'
import { useI18n } from '@/shared/hooks'

const localeLabels: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
}

/**
 * ロケール切り替えコンポーネント
 */
export function LocaleSwitcher() {
  const { locale, changeLocale } = useI18n()

  return (
    <HStack space="sm">
      {supportedLocales.map((loc) => (
        <Button
          key={loc}
          variant={locale === loc ? 'default' : 'outline'}
          size="sm"
          onPress={() => changeLocale(loc)}
        >
          <ButtonText>{localeLabels[loc]}</ButtonText>
        </Button>
      ))}
    </HStack>
  )
}
