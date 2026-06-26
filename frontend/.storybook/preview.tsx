import { withThemeByClassName } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '../apps/web/src/shared/config/i18n/messages/en.json'
import '@workspace/ui/styles/globals.css'

// TODO: Mobile UI が有効化されたらコメントを解除
// import { GluestackUIProvider } from '../packages/ui/mobile/components/gluestack-ui-provider'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    // i18n（next-intl）: useTranslations を使う Story を描画できるようにする。
    (Story) => (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Story />
      </NextIntlClientProvider>
    ),
    // Theme switching for Web components
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    // TODO: Mobile UI が有効化されたらコメントを解除
    // (Story: React.ComponentType, context) => {
    //   const isMobileStory = context.title.startsWith('Packages/UI Mobile')
    //   if (isMobileStory) {
    //     return (
    //       <GluestackUIProvider mode="light">
    //         <Story />
    //       </GluestackUIProvider>
    //     )
    //   }
    //   return <Story />
    // },
  ],
}

export default preview
