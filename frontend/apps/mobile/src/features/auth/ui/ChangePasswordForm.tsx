import type { AuthResult } from '@workspace/auth/api'
import { passwordsMatch } from '@workspace/auth/validation'
import { Button, ButtonText, VStack } from '@workspace/native-ui/components'
import { useState } from 'react'
import { useI18n } from '@/shared/hooks'
import { AuthField } from './AuthField'
import { AuthMessage } from './AuthMessage'
import { PasswordRequirements } from './PasswordRequirements'

/**
 * ログイン中のパスワード変更
 *
 * **現在のパスワードの検証は Cognito が行う**（`updatePassword({ oldPassword, newPassword })`）。
 * `signIn` を検証目的で呼ぶのは新しいセッションが発行される副作用があり誤り
 * （`.claude/rules/auth.md` §3.3）。
 */
export function ChangePasswordForm({
  submit,
}: {
  submit: (oldPassword: string, newPassword: string) => Promise<AuthResult>
}) {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  const toggleLabels = { show: t('auth.showPassword'), hide: t('auth.hidePassword') }

  const handleSubmit = async () => {
    if (!currentPassword) {
      setResult({ success: false, errorKey: 'currentPasswordRequired' })
      return
    }
    if (!passwordsMatch(password, confirmation)) {
      setResult({ success: false, errorKey: 'passwordMismatch' })
      return
    }
    setPending(true)
    setResult(null)
    const next = await submit(currentPassword, password)
    setResult(next)
    setPending(false)
    if (next.success) {
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
    }
  }

  return (
    <VStack className="gap-4">
      <AuthField
        label={t('auth.currentPasswordLabel')}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secure
        autoComplete="password"
        textContentType="password"
        isDisabled={pending}
        toggleLabels={toggleLabels}
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

      {result ? (
        <AuthMessage
          tone={result.success ? 'success' : 'error'}
          message={
            result.success
              ? t(`auth.success.${result.successKey ?? 'passwordUpdated'}`)
              : t(`auth.errors.${result.errorKey}`)
          }
        />
      ) : null}

      <Button onPress={handleSubmit} isDisabled={pending}>
        <ButtonText>{pending ? t('auth.saving') : t('auth.updatePassword')}</ButtonText>
      </Button>
    </VStack>
  )
}
