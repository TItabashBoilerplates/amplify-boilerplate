import { Button, ButtonText } from '@workspace/native-ui/components'
import { Text, View } from 'react-native'

import { useI18n } from '@/shared/hooks'

/**
 * NativeWind & gluestack-ui デモセクション
 */
export function DemoSection() {
  const { t } = useI18n()

  return (
    <>
      {/* NativeWind v5 Demo */}
      <View className="bg-blue-500 p-4 rounded-lg mb-4">
        <Text className="text-white font-bold text-lg">{t('HomeScreen.nativewindDemo')}</Text>
        <Text className="text-white/80">{t('HomeScreen.nativewindSubtitle')}</Text>
      </View>

      {/* gluestack-ui Button Demo */}
      <View className="gap-3 mb-4">
        <Text className="text-lg font-bold">{t('HomeScreen.gluestackButtons')}</Text>
        <Button action="primary" onPress={() => console.log('Primary pressed')}>
          <ButtonText>{t('HomeScreen.primaryButton')}</ButtonText>
        </Button>
        <Button action="secondary" onPress={() => console.log('Secondary pressed')}>
          <ButtonText>{t('HomeScreen.secondaryButton')}</ButtonText>
        </Button>
        <Button variant="outline" onPress={() => console.log('Outline pressed')}>
          <ButtonText>{t('HomeScreen.outlineButton')}</ButtonText>
        </Button>
        <Button size="lg" onPress={() => console.log('Large pressed')}>
          <ButtonText>{t('HomeScreen.largeButton')}</ButtonText>
        </Button>
      </View>
    </>
  )
}
