import { withThemeByClassName } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react'
import { GluestackUIProvider } from '@workspace/native-ui/components'
import { QueryProvider } from '@workspace/query'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '../apps/web/src/shared/config/i18n/messages/en.json'
import jaMessages from '../apps/web/src/shared/config/i18n/messages/ja.json'
import { deviceViewports } from './viewports'

// 実メッセージをそのまま読む。ダミー文言を置くとカタログと本番でテキスト量が変わり、
// 「Storybook では収まっていたのに本番で折り返す」という崩れ方をする。
const MESSAGES = { en: enMessages, ja: jaMessages } as const
type Locale = keyof typeof MESSAGES

// Tailwind + デザイントークン。Web / Native 両方のクラスをここで生成している
// （詳細は ./storybook.css のコメント参照）
import './storybook.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // 実機相当の画面幅に切り替えて確認するためのプリセット（ツールバーの Viewport から選ぶ）。
    // 「MobileView 用の Story を作らず Viewport ツールを使う」方針の前提になるもの。
    // ⚠️ ストア用スクショの生成には使えない（理由は ./viewports.ts のコメント参照）
    viewport: { options: deviceViewports },
  },
  // ツールバーからロケールを切り替えられるようにする。
  // 日本語は英語より文字幅が広く行数も変わるため、**両方で崩れないこと**を
  // カタログ上で確認できる必要がある（i18n は必須ポリシー）。
  globalTypes: {
    locale: {
      description: 'Locale',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'ja', title: '日本語' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'en' },
  decorators: [
    // apps/web のコンポーネントは next-intl の `useTranslations` を使うため、
    // プロバイダーが無いと **描画時に例外**になる（ビルドは通るので気づけない）。
    (Story, context) => {
      const locale = (context.globals.locale as Locale) ?? 'en'
      return (
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
          <Story />
        </NextIntlClientProvider>
      )
    },
    // TanStack Query: サーバーステートを扱うコンポーネント（PasskeyManager 等）の Story 用。
    // 無いと "No QueryClient set" で描画できない。
    (Story) => (
      <QueryProvider>
        <Story />
      </QueryProvider>
    ),
    // Mobile ストーリーだけ gluestack のプロバイダーで包む。
    // SafeAreaProvider が無いと `useSafeAreaInsets()` が例外を投げるため、
    // SafeAreaView 等を含むストーリーはこれが無いとレンダリング自体が失敗する。
    (Story, context) => {
      if (
        context.title.startsWith('Packages/UI Mobile') ||
        context.title.startsWith('Apps/Mobile')
      ) {
        return (
          <GluestackUIProvider>
            <Story />
          </GluestackUIProvider>
        )
      }
      return <Story />
    },
    // Web / Native 共通のテーマ切り替え。
    // Storybook のカタログは `.dark` クラス方式に寄せてある（./storybook.css 参照）。
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
}

export default preview
