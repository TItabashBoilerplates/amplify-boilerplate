/**
 * Shared TailwindCSS v4 configuration for Web
 * Re-exports theme configuration for easy consumption
 */

export * from './theme'

// Web-specific content paths
export const webContent = [
  './app/**/*.{js,jsx,ts,tsx}',
  './src/**/*.{js,jsx,ts,tsx}',
  '../../packages/ui/**/*.{js,jsx,ts,tsx}',
  '../../packages/tokens/**/*.{js,jsx,ts,tsx}',
  '../../packages/app/**/*.{js,jsx,ts,tsx}',
] as const
