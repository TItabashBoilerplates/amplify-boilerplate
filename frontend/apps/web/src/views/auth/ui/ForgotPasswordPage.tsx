'use client'

import { KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ForgotPasswordForm } from '@/features/auth'
import { AuthCard } from './AuthCard'

/**
 * パスワード再設定ページ（未ログインからの復旧）
 *
 * **ログイン画面から必ず到達できること**（`.claude/rules/auth.md` §2）。
 * パスワードを忘れた人はログインできないので、設定画面に置いても意味が無い。
 */
export function ForgotPasswordPage() {
  const t = useTranslations('Auth')

  return (
    <AuthCard
      title={t('forgotPasswordTitle')}
      description={t('forgotPasswordDescription')}
      icon={<KeyRound className="h-6 w-6 text-primary" aria-hidden="true" />}
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
