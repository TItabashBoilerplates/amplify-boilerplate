import { confirmPasswordReset, requestPasswordReset } from '@workspace/auth/api'
import { ForgotPasswordScreen } from '@/views/auth'

export default function ForgotPasswordRoute() {
  return (
    <ForgotPasswordScreen requestCode={requestPasswordReset} confirmReset={confirmPasswordReset} />
  )
}
