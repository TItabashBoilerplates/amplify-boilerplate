import { nativeContent, themeExtend } from '@workspace/tailwind-config/native'
import type { Config } from 'tailwindcss'

export default {
  content: nativeContent,
  theme: {
    extend: themeExtend,
  },
  plugins: [],
} satisfies Config
