'use client'

import { UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SignUpForm } from '@/features/auth'
import { AuthCard } from './AuthCard'

/** サインアップページ（メールアドレス + パスワード） */
export function SignUpPage() {
  const t = useTranslations('Auth')

  return (
    <AuthCard
      title={t('signUpTitle')}
      description={t('signUpDescription')}
      icon={<UserPlus className="h-6 w-6 text-primary" aria-hidden="true" />}
    >
      <SignUpForm />
    </AuthCard>
  )
}
