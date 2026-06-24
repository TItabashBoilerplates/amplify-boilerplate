import { ParallaxScrollView, ThemedText, ThemedView } from '@workspace/native-ui/layout'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'

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
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }
    >
      {/* 言語切り替え */}
      <ThemedView style={styles.languageSwitcher}>
        <LocaleSwitcher />
      </ThemedView>

      {/* デモセクション */}
      <DemoSection />

      {/* ウェルカムセクション */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">{t('HomeScreen.title')}</ThemedText>
        <HelloWave />
      </ThemedView>

      {/* ステップ 1 */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">{t('HomeScreen.step1Title')}</ThemedText>
        <ThemedText>
          {t('HomeScreen.step1Description')}{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          {t('HomeScreen.step1DevTools')}
        </ThemedText>
      </ThemedView>

      {/* ステップ 2 */}
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <ThemedText type="subtitle">{t('HomeScreen.step2Title')}</ThemedText>
        </Link>
        <ThemedText>{t('HomeScreen.step2Description')}</ThemedText>
      </ThemedView>

      {/* ステップ 3 */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">{t('HomeScreen.step3Title')}</ThemedText>
        <ThemedText>{t('HomeScreen.step3Description')}</ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  )
}

const styles = StyleSheet.create({
  languageSwitcher: {
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
})
