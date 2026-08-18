import type { AuthResult, SignInNextStep } from '@workspace/auth/api'
import { Button, ButtonText, Pressable, Text, VStack } from '@workspace/native-ui/components'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useI18n } from '@/shared/hooks'
import { AuthField } from './AuthField'
import { AuthMessage } from './AuthMessage'

/**
 * ログインフォーム（メールアドレス + パスワード）
 *
 * **ストア審査ではこの画面が使われる。** 審査担当者に渡せるのは
 * 「メールアドレスとパスワードの組」だけなので、この経路だけでログインし切れる
 * 状態を必ず保つこと（OTP のみは App Store 2.1(a) でリジェクト）。
 *
 * 「パスワードをお忘れですか？」を**この画面に**置いているのは、忘れた人は
 * ログインできず設定画面に到達できないため。
 *
 * `signIn` を props で受け取るのは、実 API が `amplify_outputs.json` を要求し
 * Storybook では読めないため。副作用と UI を分けて各状態を確認できるようにしている。
 */
export function SignInForm({
  signIn,
}: {
  signIn: (email: string, password: string) => Promise<AuthResult<SignInNextStep>>
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AuthResult<SignInNextStep> | null>(null)

  const toggleLabels = { show: t('auth.showPassword'), hide: t('auth.hidePassword') }

  const handleSubmit = async () => {
    setPending(true)
    setResult(null)
    const next = await signIn(email, password)
    setResult(next)
    setPending(false)
    if (next.success && next.nextStep === 'signedIn') {
      router.replace('/')
    }
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

      <AuthField
        label={t('auth.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="password"
        textContentType="password"
        isDisabled={pending}
        toggleLabels={toggleLabels}
      />

      <Pressable
        onPress={() => router.push('/forgot-password')}
        accessibilityRole="link"
        className="self-end py-2"
      >
        <Text className="text-sm text-muted-foreground">{t('auth.forgotPassword')}</Text>
      </Pressable>

      {result && !result.success ? (
        <VStack className="gap-2">
          <AuthMessage tone="error" message={t(`auth.errors.${result.errorKey}`)} />
          {/*
           * 管理者リセット / 未確認ユーザーを握りつぶすと、ログイン画面が
           * 行き止まりになる（何をすれば直るのか分からない）。
           */}
          {result.requiresPasswordReset ? (
            <Pressable
              onPress={() => router.push('/forgot-password')}
              accessibilityRole="link"
              className="py-2"
            >
              <Text className="text-sm font-medium text-primary">{t('auth.resetPasswordNow')}</Text>
            </Pressable>
          ) : null}
          {result.requiresConfirmation ? (
            <Pressable
              onPress={() => router.push('/sign-up')}
              accessibilityRole="link"
              className="py-2"
            >
              <Text className="text-sm font-medium text-primary">{t('auth.confirmEmailNow')}</Text>
            </Pressable>
          ) : null}
        </VStack>
      ) : null}

      <Button onPress={handleSubmit} isDisabled={pending}>
        <ButtonText>{pending ? t('auth.signingIn') : t('auth.signIn')}</ButtonText>
      </Button>

      <Pressable onPress={() => router.push('/sign-up')} accessibilityRole="link" className="py-2">
        <Text className="text-center text-sm text-muted-foreground">{t('auth.noAccount')}</Text>
      </Pressable>
    </VStack>
  )
}
