import type { AuthResult, SignUpNextStep } from '@workspace/auth/api'
import { SignUpForm } from '@/features/auth'
import { useI18n } from '@/shared/hooks'
import { AuthScreen } from './AuthScreen'

/** サインアップ画面。Cognito が確認コードを送るので確認まで 1 本のフローで持つ */
export function SignUpScreen({
  signUp,
  confirmSignUp,
  resendConfirmation,
}: {
  signUp: (email: string, password: string) => Promise<AuthResult<SignUpNextStep>>
  confirmSignUp: (email: string, code: string) => Promise<AuthResult<'signedIn' | 'signIn'>>
  resendConfirmation: (email: string) => Promise<AuthResult>
}) {
  const { t } = useI18n()
  return (
    <AuthScreen title={t('auth.signUpTitle')} description={t('auth.signUpDescription')}>
      <SignUpForm
        signUp={signUp}
        confirmSignUp={confirmSignUp}
        resendConfirmation={resendConfirmation}
      />
    </AuthScreen>
  )
}
