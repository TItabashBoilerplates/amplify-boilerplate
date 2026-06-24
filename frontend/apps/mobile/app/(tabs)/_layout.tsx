import { IconSymbol } from '@workspace/native-ui/components'
import { Colors } from '@workspace/native-ui/constants'
import { useColorScheme } from '@workspace/native-ui/hooks'
import { Tabs } from 'expo-router'

import { useI18n } from '@/shared/hooks'
import { HapticTab } from '@/shared/ui'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const { t } = useI18n()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.home'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('navigation.explore'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  )
}
