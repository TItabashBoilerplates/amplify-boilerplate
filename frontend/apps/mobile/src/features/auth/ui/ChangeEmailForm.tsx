import type { AuthResult } from '@workspace/auth/api'
import { Button, ButtonText, Text, VStack } from '@workspace/native-ui/components'
import { useState } from 'react'
import { useI18n } from '@/shared/hooks'
import { AuthField } from './AuthField'
import { AuthMessage } from './AuthMessage'

/**
 * メールアドレスの再設定（2 段階）
 *
 * Cognito は新しいアドレスへ確認コードを送る。**`AttributesRequireVerificationBeforeUpdate`
 * を設定してあるので、確認が完了するまで現在のアドレスでログインし続けられる**
 * （設定が無いと旧・新どちらでもログインできなくなる。`.claude/rules/auth.md` §3.4）。
 * その旨を UI にも明示しないと「変わっていない」という問い合わせになる。
 */
export function ChangeEmailForm({
  currentEmail,
  submit,
  confirm,
}: {
  currentEmail: string
  submit: (newEmail: string) => Promise<AuthResult<'confirm' | 'done'>>
  confirm: (code: string) => Promise<AuthResult>
}) {
  const { t } = useI18n()
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AuthResult<string> | null>(null)

  const handleRequest = async () => {
    setPending(true)
    setResult(null)
    const next = await submit(newEmail)
    setResult(next)
    setPending(false)
    if (next.success && next.nextStep === 'confirm') {
      setStep('confirm')
    }
  }

  const handleConfirm = async () => {
    setPending(true)
    setResult(null)
    const next = await confirm(code)
    setResult(next)
    setPending(false)
    if (next.success) {
      setStep('request')
      setNewEmail('')
      setCode('')
    }
  }

  return (
    <VStack className="gap-4">
      <Text className="text-sm text-muted-foreground">
        {t('auth.currentEmail')}: {currentEmail}
      </Text>

      {step === 'request' ? (
        <>
          <AuthField
            label={t('auth.newEmailLabel')}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            isDisabled={pending}
          />
          <Text className="text-xs text-muted-foreground">
            {t('auth.emailChangeVerificationNotice')}
          </Text>
        </>
      ) : (
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
      )}

      {result ? (
        <AuthMessage
          tone={result.success ? 'success' : 'error'}
          message={
            result.success
              ? t(`auth.success.${result.successKey ?? 'emailChangeRequested'}`)
              : t(`auth.errors.${result.errorKey}`)
          }
        />
      ) : null}

      <Button
        onPress={step === 'request' ? handleRequest : handleConfirm}
        isDisabled={pending}
        variant="outline"
      >
        <ButtonText>
          {pending
            ? t('auth.saving')
            : step === 'request'
              ? t('auth.changeEmail')
              : t('auth.confirm')}
        </ButtonText>
      </Button>
    </VStack>
  )
}
