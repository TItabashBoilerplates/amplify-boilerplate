import { HStack, IconSymbol, Text } from '@workspace/native-ui/components'
import { Colors } from '@workspace/native-ui/constants'
import { ParallaxScrollView } from '@workspace/native-ui/layout'
import { Image } from 'expo-image'
import { Platform } from 'react-native'

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
      headerImage={
        <IconSymbol
          size={310}
          color={Colors.light.icon}
          name="chevron.left.forwardslash.chevron.right"
          style={{ position: 'absolute', bottom: -90, left: -35 }}
        />
      }
    >
      <HStack space="sm">
        <Text size="4xl" bold>
          {t('ExploreScreen.title')}
        </Text>
      </HStack>
      <Text>{t('ExploreScreen.intro')}</Text>

      <CollapsibleSection title={t('ExploreScreen.fileBasedRouting')}>
        <Text>{t('ExploreScreen.fileBasedRoutingDesc')}</Text>
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <Text className="text-primary underline">{t('ExploreScreen.learnMore')}</Text>
        </ExternalLink>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.platformSupport')}>
        <Text>{t('ExploreScreen.platformSupportDesc')}</Text>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.images')}>
        <Text>{t('ExploreScreen.imagesDesc')}</Text>
        <Image
          source={require('@/assets/images/react-logo.png')}
          style={{ width: 100, height: 100, alignSelf: 'center' }}
        />
        <ExternalLink href="https://reactnative.dev/docs/images">
          <Text className="text-primary underline">{t('ExploreScreen.learnMore')}</Text>
        </ExternalLink>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.lightDarkMode')}>
        <Text>{t('ExploreScreen.lightDarkModeDesc')}</Text>
        <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
          <Text className="text-primary underline">{t('ExploreScreen.learnMore')}</Text>
        </ExternalLink>
      </CollapsibleSection>

      <CollapsibleSection title={t('ExploreScreen.animations')}>
        <Text>{t('ExploreScreen.animationsDesc')}</Text>
        {Platform.select({
          ios: <Text>{t('ExploreScreen.parallaxInfo')}</Text>,
        })}
      </CollapsibleSection>
    </ParallaxScrollView>
  )
}
