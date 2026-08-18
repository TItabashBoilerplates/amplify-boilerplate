import type { AuthResult } from '@workspace/auth/api'
import { normalizeEmail } from '@workspace/auth/validation'
import { Button, ButtonText, Text, VStack } from '@workspace/native-ui/components'
import { useState } from 'react'
import { useI18n } from '@/shared/hooks'
import { AuthField } from './AuthField'
import { AuthMessage } from './AuthMessage'

/**
 * アカウント削除
 *
 * **App Store 5.1.1(v) によりモバイルでは必須**（「サポートへ連絡」では不可）。
 *
 * 誤タップで消えないよう、**自分のメールアドレスを再入力させる**
 * （`.claude/rules/auth.md` §3.5 の「再認証相当の確認」）。
 *
 * ⚠️ `deleteUser()` は Cognito のユーザーだけを消す。Amplify Data（DynamoDB）の
 * 関連データは残るので、owner 認可のモデルを持つプロダクトでは削除フローの一部として
 * 明示的に消すこと。
 */
export function DeleteAccountForm({
  currentEmail,
  submit,
  signOut,
  onDeleted,
}: {
  currentEmail: string
  submit: () => Promise<AuthResult>
  signOut: () => Promise<void>
  onDeleted: () => void
}) {
  const { t } = useI18n()
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  const handleSubmit = async () => {
    if (normalizeEmail(confirmation) !== normalizeEmail(currentEmail)) {
      setResult({ success: false, errorKey: 'deleteConfirmationMismatch' })
      return
    }
    setPending(true)
    setResult(null)
    const next = await submit()
    setResult(next)
    setPending(false)
    if (next.success) {
      // 残しておくと「消えたはずのアカウントでログイン済みに見える」状態になる
      await signOut()
      onDeleted()
    }
  }

  return (
    <VStack className="gap-3">
      <Text className="text-sm text-muted-foreground">{t('account.deleteAccountWarning')}</Text>

      <AuthField
        label={t('account.deleteConfirmationLabel', { email: currentEmail })}
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder={currentEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        isDisabled={pending}
      />

      {result && !result.success ? (
        <AuthMessage tone="error" message={t(`auth.errors.${result.errorKey}`)} />
      ) : null}

      <Button onPress={handleSubmit} isDisabled={pending} variant="destructive">
        <ButtonText>
          {pending ? t('account.deletingAccount') : t('account.deleteAccountConfirm')}
        </ButtonText>
      </Button>
    </VStack>
  )
}
