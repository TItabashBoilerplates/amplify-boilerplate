import { IconSymbol } from '@workspace/native-ui/components'
import { ParallaxScrollView, ThemedText, ThemedView } from '@workspace/native-ui/layout'
import { Image } from 'expo-image'
import { Platform, StyleSheet } from 'react-native'

import { useI18n } from '@/shared/hooks'
import { ExternalLink } from '@/shared/ui'
import { CollapsibleSection } from '@/widgets/collapsible-section'

/**
 * 探索画面
 */
export function ExploreScreen() {
  const { t } = useI18n()

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">{t('ExploreScreen.title')}</ThemedText>
      </ThemedView>
      <ThemedText>{t('ExploreScreen.intro')}</ThemedText>

      <CollapsibleSection title={t('ExploreScreen.fileBasedRouting')}>
        <ThemedText>{t('ExploreScreen.fileBasedRoutingDesc')}</ThemedText>
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <ThemedText type="link">{t('ExploreScreen.learnMore')}</ThemedText>
        </ExternalLink>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.platformSupport')}>
        <ThemedText>{t('ExploreScreen.platformSupportDesc')}</ThemedText>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.images')}>
        <ThemedText>{t('ExploreScreen.imagesDesc')}</ThemedText>
        <Image
          source={require('@/assets/images/react-logo.png')}
          style={{ width: 100, height: 100, alignSelf: 'center' }}
        />
        <ExternalLink href="https://reactnative.dev/docs/images">
          <ThemedText type="link">{t('ExploreScreen.learnMore')}</ThemedText>
        </ExternalLink>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.lightDarkMode')}>
        <ThemedText>{t('ExploreScreen.lightDarkModeDesc')}</ThemedText>
        <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
          <ThemedText type="link">{t('ExploreScreen.learnMore')}</ThemedText>
        </ExternalLink>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.animations')}>
        <ThemedText>{t('ExploreScreen.animationsDesc')}</ThemedText>
        {Platform.select({
          ios: <ThemedText>{t('ExploreScreen.parallaxInfo')}</ThemedText>,
        })}
      </CollapsibleSection>
    </ParallaxScrollView>
  )
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
})
