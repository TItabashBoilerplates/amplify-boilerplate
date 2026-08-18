import {
  confirmSignUpCode,
  resendSignUpConfirmation,
  signUpWithPassword,
} from '@workspace/auth/api'
import { SignUpScreen } from '@/views/auth'

export default function SignUpRoute() {
  return (
    <SignUpScreen
      signUp={signUpWithPassword}
      confirmSignUp={confirmSignUpCode}
      resendConfirmation={resendSignUpConfirmation}
    />
  )
}
