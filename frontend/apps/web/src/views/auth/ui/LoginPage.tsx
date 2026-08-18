'use client'

import { Button } from '@workspace/ui/components/button'
import { LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { LoginForm, PasswordLoginForm, SocialSignInButtons } from '@/features/auth'
import { AuthCard } from './AuthCard'

/**
 * ログインページ
 *
 * **主たるログイン手段はメール + パスワード**（`PasswordLoginForm`）。
 * ワンタイムコード（Email OTP）とソーシャルは併置の補助手段として出す。
 *
 * モバイルアプリを出すプロダクトでパスワードログインを外すと、
 * App Store Review 2.1(a)（審査担当者に渡せる資格情報）を満たせずリジェクトされる
 * （`.claude/rules/auth.md`）。**この構成を OTP のみに戻さないこと。**
 */
export function LoginPage() {
  const t = useTranslations('Auth')
  const [useOtp, setUseOtp] = useState(false)

  return (
    <AuthCard
      title={t('signInTitle')}
      description={t('signInDescription')}
      icon={<LogIn className="h-6 w-6 text-primary" aria-hidden="true" />}
    >
      <div className="space-y-4">
        {useOtp ? <LoginForm /> : <PasswordLoginForm />}

        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground text-sm"
          onClick={() => setUseOtp((previous) => !previous)}
        >
          {useOtp ? t('signIn') : t('signInWithOtpInstead')}
        </Button>

        {/* ソーシャルログイン（backend で externalProviders を有効化したものだけ表示） */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-border border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">{t('orContinueWith')}</span>
          </div>
        </div>

        <SocialSignInButtons />
      </div>
    </AuthCard>
  )
}
