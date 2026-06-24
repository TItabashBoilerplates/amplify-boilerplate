/**
 * ユーザーエンティティの型定義
 *
 * Web/Native 間で共有されるユーザー関連の型
 */

import type { AuthUser } from '@workspace/auth'

/**
 * アプリケーション内で使用するユーザー型
 */
export interface AppUser {
  id: string
  email: string | undefined
  displayName: string | null
  avatarUrl: string | null
}

/**
 * 認証ユーザー（Cognito / Amplify Auth）から AppUser への変換。
 *
 * displayName / avatarUrl は Amplify Data の `User` プロフィールモデルや
 * Cognito のカスタム属性から後段で補完する想定。
 */
export function toAppUser(user: AuthUser): AppUser {
  return {
    id: user.userId,
    email: user.email,
    displayName: null,
    avatarUrl: null,
  }
}
