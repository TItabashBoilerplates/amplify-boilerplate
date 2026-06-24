import type { AuthUser } from '@workspace/auth'

/**
 * 認証ユーザー（Cognito / Amplify Auth）。`@workspace/auth` の型を再利用。
 */
export type { AuthUser }

export interface User {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  userId: string
  bio?: string
  location?: string
}
