import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { getTranslations } from 'next-intl/server'
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountForm } from '@/features/auth'
import { loadCurrentUserEmail } from '../model/loadCurrentUserEmail'

/**
 * アカウント設定ページ
 *
 * `.claude/rules/auth.md` §2 が要求する 3 導線を **1 画面にまとめる**:
 *
 * 1. メールアドレスの再設定（認証方式を問わず必須）
 * 2. パスワードの変更
 * 3. アカウントの削除（App Store 5.1.1(v) でモバイルは必須）
 *
 * ユーザーは「自分の情報を変えたい」ときに設定画面を探すのであって、
 * 機能ごとに別の場所を探しはしない。**これらを分散させないこと。**
 *
 * 現在のメールアドレスは **サーバー側**で解決する（`runWithAmplifyServerContext`）。
 * クライアントが持っている値をサーバーの判断根拠にしない（`.claude/rules/auth.md` §3.7）。
 */
export async function AccountPage() {
  const t = await getTranslations('Account')
  const email = await loadCurrentUserEmail()

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="font-bold text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('emailSectionTitle')}</CardTitle>
          <CardDescription>{t('emailSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm currentEmail={email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('passwordSectionTitle')}</CardTitle>
          <CardDescription>{t('passwordSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t('dangerSectionTitle')}</CardTitle>
          <CardDescription>{t('dangerSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm email={email} />
        </CardContent>
      </Card>
    </div>
  )
}
