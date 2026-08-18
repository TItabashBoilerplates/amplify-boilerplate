import { Box, Text } from '@workspace/native-ui/components'
import { Link } from 'expo-router'

import { useI18n } from '@/shared/hooks'

/**
 * モーダル画面
 */
export function ModalScreen() {
  const { t } = useI18n()

  return (
    <Box className="flex-1 items-center justify-center p-5">
      <Text size="4xl" bold>
        {t('ModalScreen.title')}
      </Text>
      <Text>{t('ModalScreen.description')}</Text>
      <Link href="/" dismissTo className="mt-4 py-4">
        <Text className="text-primary underline">{t('ModalScreen.goToHome')}</Text>
      </Link>
    </Box>
  )
}
