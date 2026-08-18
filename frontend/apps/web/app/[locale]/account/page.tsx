import { AccountPage } from '@/views/account'
import { Header } from '@/widgets/header'

/**
 * アカウント設定ページ（Next.js App Router）
 *
 * メールアドレス変更 / パスワード変更 / アカウント削除の導線を持つ。
 * これらは `.claude/rules/auth.md` §2 の必須導線であり、**消してはならない**。
 *
 * URL: /account
 */
export default function Page() {
  return (
    <div className="min-h-screen pt-16">
      <Header />
      <AccountPage />
    </div>
  )
}
