import { setRequestLocale } from 'next-intl/server'
import { CheckoutSuccessView } from '@/views/checkout'
import { Header } from '@/widgets/header'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function CheckoutSuccessPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="min-h-screen pt-16">
      <Header />
      <CheckoutSuccessView />
    </div>
  )
}
