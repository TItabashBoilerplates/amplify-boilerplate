import { Skeleton } from '@workspace/ui/components/skeleton'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/widgets/header'

export default async function LocaleLoading() {
  const t = await getTranslations('Loading')

  return (
    <div className="min-h-screen pt-16">
      <Header />
      <main
        aria-busy="true"
        aria-live="polite"
        className="container mx-auto space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
      >
        <span className="sr-only">{t('page')}</span>
        <div className="space-y-2">
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-8">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    </div>
  )
}
