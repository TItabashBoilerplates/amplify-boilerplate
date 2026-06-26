'use client'

import { type SocialProvider, signInWithSocial } from '@workspace/app'
import { Button } from '@workspace/ui/components/button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * ソーシャルログインボタン群（Cognito Hosted UI 経由の OAuth リダイレクト）。
 *
 * バックエンドの `loginWith.externalProviders`（`amplify/auth/resource.ts`）で
 * 有効化したプロバイダだけを `providers` に渡す。未設定のプロバイダは押すと失敗する。
 *
 * @example
 * ```tsx
 * <SocialSignInButtons providers={['Google', 'Apple']} />
 * ```
 */
export interface SocialSignInButtonsProps {
  /** 表示・有効化するプロバイダ（バックエンドで有効化済みのものに限る） */
  providers?: SocialProvider[]
  className?: string
}

export function SocialSignInButtons({
  providers = ['Google', 'Apple'],
  className,
}: SocialSignInButtonsProps) {
  const t = useTranslations('auth')
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [error, setError] = useState('')

  const handleClick = async (provider: SocialProvider) => {
    setPending(provider)
    setError('')
    const result = await signInWithSocial(provider)
    // 成功時はブラウザが IdP へリダイレクトするため、ここには通常戻らない。
    if ('error' in result) {
      setError(result.error)
      setPending(null)
    }
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => handleClick(provider)}
        >
          {pending === provider ? t('redirecting') : t('continueWithProvider', { provider })}
        </Button>
      ))}

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
