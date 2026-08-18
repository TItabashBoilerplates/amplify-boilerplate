import '../global.css'

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'

import { AppProvider } from '@/app'

export const unstable_settings = {
  anchor: '(tabs)',
}

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </AppProvider>
  )
}
