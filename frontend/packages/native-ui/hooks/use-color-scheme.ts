import { useColorScheme as useRNColorScheme } from 'react-native'

/**
 * カラースキームフック
 * 'light' または 'dark' を返す（null/undefined/'unspecified'の場合は'light'にフォールバック）
 */
export function useColorScheme(): 'light' | 'dark' {
  const colorScheme = useRNColorScheme()
  // React Native 0.82以降では 'unspecified' も返す可能性がある
  if (colorScheme === 'dark') {
    return 'dark'
  }
  return 'light'
}
