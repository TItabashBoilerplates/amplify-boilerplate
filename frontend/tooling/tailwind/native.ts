/**
 * Shared TailwindCSS v4 configuration for React Native (NativeWind v5)
 * Re-exports theme configuration with native-specific content paths
 */

export * from './theme'

// Native-specific content paths for NativeWind
// Not using `as const` to allow mutable array assignment in tailwind.config.ts
export const nativeContent: string[] = [
  './app/**/*.{js,jsx,ts,tsx}',
  './components/**/*.{js,jsx,ts,tsx}',
  '../../packages/native-ui/**/*.{js,jsx,ts,tsx}',
  '../../packages/tokens/**/*.{js,jsx,ts,tsx}',
  '../../packages/app/**/*.{js,jsx,ts,tsx}',
]

// NativeWind v5 preset configuration helper
export const nativePreset = {
  content: nativeContent,
}
