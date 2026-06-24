import { setRequestLocale } from 'next-intl/server'
import { HomePage } from '@/views/home'
import { Header } from '@/widgets/header'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params

  // 静的レンダリングを有効化
  setRequestLocale(locale)

  return (
    <div className="min-h-screen pt-16">
      <Header />
      <HomePage />
    </div>
  )
}
