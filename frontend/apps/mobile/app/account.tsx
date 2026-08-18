import {
  changeEmail,
  changePassword,
  confirmEmailChange,
  deleteAccount,
  signOut,
} from '@workspace/auth/api'
import { fetchUserAttributes } from 'aws-amplify/auth'
import { AccountScreen } from '@/views/account'

/**
 * 現在のメールアドレスを Cognito から取得する。
 *
 * ローカルに保持した値ではなく **Cognito のユーザー属性**を読む
 * （メール変更の確認が完了するまで属性は切り替わらないため、実態と一致する）。
 */
async function loadEmail(): Promise<string> {
  const attributes = await fetchUserAttributes()
  return attributes.email ?? ''
}

export default function AccountRoute() {
  return (
    <AccountScreen
      loadEmail={loadEmail}
      changeEmail={changeEmail}
      confirmEmailChange={confirmEmailChange}
      changePassword={changePassword}
      deleteAccount={deleteAccount}
      signOut={signOut}
    />
  )
}
