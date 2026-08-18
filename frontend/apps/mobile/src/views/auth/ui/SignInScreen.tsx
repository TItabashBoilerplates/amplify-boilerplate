import type { AuthResult, SignInNextStep } from '@workspace/auth/api'
import { SignInForm } from '@/features/auth'
import { useI18n } from '@/shared/hooks'
import { AuthScreen } from './AuthScreen'

/** ログイン画面。審査担当者がここからメール + パスワードで入る */
export function SignInScreen({
  signIn,
}: {
  signIn: (email: string, password: string) => Promise<AuthResult<SignInNextStep>>
}) {
  const { t } = useI18n()
  return (
    <AuthScreen title={t('auth.signInTitle')} description={t('auth.signInDescription')}>
      <SignInForm signIn={signIn} />
    </AuthScreen>
  )
}
