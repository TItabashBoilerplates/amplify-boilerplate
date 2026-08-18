import type { AuthResult } from '@workspace/auth/api'
import {
  Box,
  Button,
  ButtonText,
  SafeAreaView,
  Text,
  VStack,
} from '@workspace/native-ui/components'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountForm } from '@/features/auth'
import { useI18n } from '@/shared/hooks'

/**
 * アカウント設定画面
 *
 * `.claude/rules/auth.md` §2 が要求する「設定画面に置く導線」をまとめる:
 * メールアドレス再設定 / パスワード変更 / アカウント削除。
 *
 * **モバイルではアカウント削除がストア要件**（App Store 5.1.1(v)。
 * 「サポートへ連絡」では不可）。
 */
export function AccountScreen({
  loadEmail,
  changeEmail,
  confirmEmailChange,
  changePassword,
  deleteAccount,
  signOut,
}: {
  /** 現在のメールアドレスを取得する。認可判断はサーバー側の値で行う */
  loadEmail: () => Promise<string>
  changeEmail: (newEmail: string) => Promise<AuthResult<'confirm' | 'done'>>
  confirmEmailChange: (code: string) => Promise<AuthResult>
  changePassword: (oldPassword: string, newPassword: string) => Promise<AuthResult>
  deleteAccount: () => Promise<AuthResult>
  signOut: () => Promise<void>
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState('')

  useEffect(() => {
    let active = true
    loadEmail()
      .then((value) => {
        if (active) {
          setEmail(value)
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load current user:', error)
      })
    return () => {
      active = false
    }
  }, [loadEmail])

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <VStack className="gap-8">
          <VStack className="gap-1">
            <Text className="text-2xl font-bold text-foreground">{t('account.title')}</Text>
            <Text className="text-sm text-muted-foreground">{t('account.description')}</Text>
          </VStack>

          <VStack className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              {t('account.emailSectionTitle')}
            </Text>
            <ChangeEmailForm
              currentEmail={email}
              submit={changeEmail}
              confirm={confirmEmailChange}
            />
          </VStack>

          <VStack className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              {t('account.passwordSectionTitle')}
            </Text>
            <ChangePasswordForm submit={changePassword} />
          </VStack>

          <VStack className="gap-3">
            <Text className="text-lg font-semibold text-destructive">
              {t('account.dangerSectionTitle')}
            </Text>
            <Box className="rounded-md border border-destructive/40 p-3">
              <DeleteAccountForm
                currentEmail={email}
                submit={deleteAccount}
                signOut={signOut}
                onDeleted={() => router.replace('/sign-in')}
              />
            </Box>
          </VStack>

          <Button
            variant="outline"
            onPress={async () => {
              await signOut()
              router.replace('/sign-in')
            }}
          >
            <ButtonText>{t('account.signOut')}</ButtonText>
          </Button>
        </VStack>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}
