import { Box, Button, ButtonText, Text, VStack } from '@workspace/native-ui/components'

import { useI18n } from '@/shared/hooks'

/**
 * NativeWind & gluestack-ui デモセクション
 *
 * クラス名は Web (shadcn/ui) とまったく同じセマンティックトークンを使う。
 * 生のパレット色（`bg-blue-500` など）は使わないこと（`.claude/rules/frontend.md`）。
 */
export function DemoSection() {
  const { t } = useI18n()

  return (
    <>
      {/* NativeWind v5 Demo */}
      <Box className="mb-4 rounded-lg bg-primary p-4">
        <Text bold size="lg" className="text-primary-foreground">
          {t('HomeScreen.nativewindDemo')}
        </Text>
        <Text className="text-primary-foreground/80">{t('HomeScreen.nativewindSubtitle')}</Text>
      </Box>

      {/* gluestack-ui Button Demo */}
      <VStack space="md" className="mb-4">
        <Text bold size="lg">
          {t('HomeScreen.gluestackButtons')}
        </Text>
        <Button onPress={() => console.log('Primary pressed')}>
          <ButtonText>{t('HomeScreen.primaryButton')}</ButtonText>
        </Button>
        <Button variant="secondary" onPress={() => console.log('Secondary pressed')}>
          <ButtonText>{t('HomeScreen.secondaryButton')}</ButtonText>
        </Button>
        <Button variant="outline" onPress={() => console.log('Outline pressed')}>
          <ButtonText>{t('HomeScreen.outlineButton')}</ButtonText>
        </Button>
        <Button size="lg" onPress={() => console.log('Large pressed')}>
          <ButtonText>{t('HomeScreen.largeButton')}</ButtonText>
        </Button>
      </VStack>
    </>
  )
}
