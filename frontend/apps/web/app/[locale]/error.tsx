'use client'

import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LocaleError({ error, reset }: ErrorProps) {
  const t = useTranslations('ErrorBoundary')

  useEffect(() => {
    console.error('Locale segment error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">digest: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex justify-center gap-3">
          <Button onClick={() => reset()}>{t('retry')}</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            {t('backHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
