import { ThemedText, ThemedView } from '@workspace/native-ui/layout'
import { Link } from 'expo-router'
import { StyleSheet } from 'react-native'

import { useI18n } from '@/shared/hooks'

/**
 * モーダル画面
 */
export function ModalScreen() {
  const { t } = useI18n()

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t('ModalScreen.title')}</ThemedText>
      <ThemedText>{t('ModalScreen.description')}</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">{t('ModalScreen.goToHome')}</ThemedText>
      </Link>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
})
