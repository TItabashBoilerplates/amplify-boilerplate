import { AuthProvider } from '@workspace/auth'
import { QueryProvider } from '@workspace/query'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { APP_URL } from '@/shared/config/app'
import { routing } from '@/shared/config/i18n'
import { ConfigureAmplifyClientSide } from '@/shared/lib/amplify'
import '@/app/styles/globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/**
 * ルートのメタデータ。**ロケールごとに出し分ける**ため静的な `metadata` ではなく
 * `generateMetadata` を使う（静的だと `/ja` でも英語の title / description が出る）。
 *
 * `metadataBase` を設定しないと OG 画像・canonical が相対 URL のままになり、
 * SNS のクローラが解決できない。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    metadataBase: new URL(APP_URL),
    title: { default: t('title'), template: `%s | ${t('siteName')}` },
    description: t('description'),
    applicationName: t('siteName'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: 'website',
      siteName: t('siteName'),
      title: t('title'),
      description: t('description'),
      locale,
      url: `/${locale}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  }
}

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  // 有効なロケールかチェック
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // 静的レンダリングを有効化
  setRequestLocale(locale)

  // メッセージを取得
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ConfigureAmplifyClientSide />
        <QueryProvider>
          <AuthProvider>
            <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
