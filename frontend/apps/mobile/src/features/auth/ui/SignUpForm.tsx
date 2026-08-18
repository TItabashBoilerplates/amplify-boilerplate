import type { AuthResult, SignUpNextStep } from '@workspace/auth/api'
import { passwordsMatch } from '@workspace/auth/validation'
import { Button, ButtonText, Pressable, Text, VStack } from '@workspace/native-ui/components'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useI18n } from '@/shared/hooks'
import { AuthField } from './AuthField'
import { AuthMessage } from './AuthMessage'
import { PasswordRequirements } from './PasswordRequirements'

/**
 * サインアップ（2 段階）
 *
 * Cognito は登録直後に**確認コードをメールする**ので、「送信できた」で終わらせず
 * コードの検証まで 1 本のフローとして持つ（`.claude/rules/auth.md` §6）。
 * ここで止めると、ユーザーは登録したのにログインできない状態になる。
 *
 * パスワード確認欄の一致判定だけはフォーム側で行う（Cognito には確認欄の概念が無く、
 * API へ渡す値ではないため）。判定規則は `@workspace/auth/validation` が正本。
 */
export function SignUpForm({
  signUp,
  confirmSignUp,
  resendConfirmation,
}: {
  signUp: (email: string, password: string) => Promise<AuthResult<SignUpNextStep>>
  confirmSignUp: (email: string, code: string) => Promise<AuthResult<'signedIn' | 'signIn'>>
  resendConfirmation: (email: string) => Promise<AuthResult>
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AuthResult<string> | null>(null)

  const toggleLabels = { show: t('auth.showPassword'), hide: t('auth.hidePassword') }

  const handleSignUp = async () => {
    if (!passwordsMatch(password, confirmation)) {
      setResult({ success: false, errorKey: 'passwordMismatch' })
      return
    }
    setPending(true)
    setResult(null)
    const next = await signUp(email, password)
    setResult(next)
    setPending(false)
    if (next.success && next.nextStep === 'confirm') {
      setStep('confirm')
    } else if (next.success) {
      router.replace('/')
    }
  }

  const handleConfirm = async () => {
    setPending(true)
    setResult(null)
    const next = await confirmSignUp(email, code)
    setResult(next)
    setPending(false)
    if (next.success) {
      router.replace(next.nextStep === 'signedIn' ? '/' : '/sign-in')
    }
  }

  const handleResend = async () => {
    setPending(true)
    setResult(await resendConfirmation(email))
    setPending(false)
  }

  if (step === 'confirm') {
    return (
      <VStack className="gap-4">
        <AuthMessage tone="success" message={t('auth.success.signUpConfirmationSent')} />

        <AuthField
          label={t('auth.codeLabel')}
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          isDisabled={pending}
        />

        {result && !result.success ? (
          <AuthMessage tone="error" message={t(`auth.errors.${result.errorKey}`)} />
        ) : null}

        <Button onPress={handleConfirm} isDisabled={pending}>
          <ButtonText>{pending ? t('auth.saving') : t('auth.confirmSignUp')}</ButtonText>
        </Button>

        <Pressable onPress={handleResend} accessibilityRole="link" className="py-2">
          <Text className="text-center text-sm text-muted-foreground">{t('auth.resendCode')}</Text>
        </Pressable>
      </VStack>
    )
  }

  return (
    <VStack className="gap-4">
      <AuthField
        label={t('auth.emailLabel')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        isDisabled={pending}
      />

      <VStack className="gap-2">
        <AuthField
          label={t('auth.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          isDisabled={pending}
          toggleLabels={toggleLabels}
        />
        <PasswordRequirements password={password} />
      </VStack>

      <AuthField
        label={t('auth.passwordConfirmationLabel')}
        value={confirmation}
        onChangeText={setConfirmation}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        isDisabled={pending}
        toggleLabels={toggleLabels}
      />

      {result && !result.success ? (
        <AuthMessage tone="error" message={t(`auth.errors.${result.errorKey}`)} />
      ) : null}

      <Button onPress={handleSignUp} isDisabled={pending}>
        <ButtonText>{pending ? t('auth.signingUp') : t('auth.signUp')}</ButtonText>
      </Button>

      <Pressable onPress={() => router.push('/sign-in')} accessibilityRole="link" className="py-2">
        <Text className="text-center text-sm text-muted-foreground">{t('auth.haveAccount')}</Text>
      </Pressable>
    </VStack>
  )
}
