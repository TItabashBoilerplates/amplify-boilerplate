import { Card, CardContent, CardHeader } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { getTranslations } from 'next-intl/server'

export async function DashboardBackendInfoSkeleton() {
  const t = await getTranslations('Loading')

  return (
    <Card aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('backendInfo')}</span>
      <CardHeader>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-60" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-20 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}
