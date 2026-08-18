import { Box, HStack, Text, VStack } from '@workspace/native-ui/components'
import { ParallaxScrollView } from '@workspace/native-ui/layout'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import { Platform } from 'react-native'

import { HelloWave } from '@/features/hello-wave'
import { LocaleSwitcher } from '@/features/locale-switcher'
import { useI18n } from '@/shared/hooks'
import { DemoSection } from '@/widgets/demo-section'

/**
 * ホーム画面
 */
export function HomeScreen() {
  const { t } = useI18n()

  return (
    <ParallaxScrollView
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={{ height: 178, width: 290, bottom: 0, left: 0, position: 'absolute' }}
        />
      }
    >
      {/* 言語切り替え */}
      <Box className="mb-4">
        <LocaleSwitcher />
      </Box>

      {/* デモセクション */}
      <DemoSection />

      {/* ウェルカムセクション */}
      <HStack space="sm" className="items-center">
        <Text size="4xl" bold>
          {t('HomeScreen.title')}
        </Text>
        <HelloWave />
      </HStack>

      {/* ステップ 1 */}
      <VStack space="sm" className="mb-2">
        <Text size="xl" bold>
          {t('HomeScreen.step1Title')}
        </Text>
        <Text>
          {t('HomeScreen.step1Description')}{' '}
          <Text bold>
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </Text>{' '}
          {t('HomeScreen.step1DevTools')}
        </Text>
      </VStack>

      {/* ステップ 2 */}
      <VStack space="sm" className="mb-2">
        <Link href="/modal">
          <Text size="xl" bold>
            {t('HomeScreen.step2Title')}
          </Text>
        </Link>
        <Text>{t('HomeScreen.step2Description')}</Text>
      </VStack>

      {/* ステップ 3 */}
      <VStack space="sm" className="mb-2">
        <Text size="xl" bold>
          {t('HomeScreen.step3Title')}
        </Text>
        <Text>{t('HomeScreen.step3Description')}</Text>
      </VStack>
    </ParallaxScrollView>
  )
}
