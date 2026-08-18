import type { AuthResult } from '@workspace/auth/api'
import { passwordsMatch } from '@workspace/auth/validation'
import { Button, ButtonText, Pressable, Text, VStack } from '@workspace/native-ui/components'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useI18n } from '@/shared/hooks'
import { AuthField } from './AuthField'
import { AuthMessage } from './AuthMessage'
import { PasswordRequirements } from './PasswordRequirements'

/**
 * パスワード再設定（**6 桁コード方式**）
 *
 * Cognito のパスワードリセットはコードベースなので、Web / Mobile とも同じ 2 段階に
 * なる（ディープリンクは不要。`.claude/rules/auth.md` §3.2）。
 *
 * 1. メールアドレスを入力 → コード送信（**アカウントの有無は返さない**）
 * 2. コード + 新パスワードを入力 → `confirmResetPassword`
 *
 * **「送信できた」で終わらせない。** コードを受け取って確定するまでが 1 本のフロー。
 */
export function ForgotPasswordForm({
  requestCode,
  confirmReset,
}: {
  requestCode: (email: string) => Promise<AuthResult>
  confirmReset: (email: string, code: string, newPassword: string) => Promise<AuthResult>
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  const toggleLabels = { show: t('auth.showPassword'), hide: t('auth.hidePassword') }

  const handleRequest = async () => {
    setPending(true)
    setResult(null)
    const next = await requestCode(email)
    setResult(next)
    setPending(false)
    if (next.success) {
      setStep('verify')
    }
  }

  const handleReset = async () => {
    if (!passwordsMatch(password, confirmation)) {
      setResult({ success: false, errorKey: 'passwordMismatch' })
      return
    }
    setPending(true)
    setResult(null)
    const next = await confirmReset(email, code, password)
    setResult(next)
    setPending(false)
    if (next.success) {
      router.replace('/sign-in')
    }
  }

  if (step === 'request') {
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

        {result && !result.success ? (
          <AuthMessage tone="error" message={t(`auth.errors.${result.errorKey}`)} />
        ) : null}

        <Button onPress={handleRequest} isDisabled={pending}>
          <ButtonText>{pending ? t('auth.sending') : t('auth.sendResetCode')}</ButtonText>
        </Button>

        <Pressable onPress={() => router.back()} accessibilityRole="link" className="py-2">
          <Text className="text-center text-sm text-muted-foreground">
            {t('auth.backToSignIn')}
          </Text>
        </Pressable>
      </VStack>
    )
  }

  return (
    <VStack className="gap-4">
      <AuthMessage tone="success" message={t('auth.success.passwordResetCodeSent')} />

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

      <VStack className="gap-2">
        <AuthField
          label={t('auth.newPasswordLabel')}
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

      <Button onPress={handleReset} isDisabled={pending}>
        <ButtonText>{pending ? t('auth.saving') : t('auth.updatePassword')}</ButtonText>
      </Button>

      <Pressable onPress={() => setStep('request')} accessibilityRole="link" className="py-2">
        <Text className="text-center text-sm text-muted-foreground">{t('auth.resendCode')}</Text>
      </Pressable>
    </VStack>
  )
}
