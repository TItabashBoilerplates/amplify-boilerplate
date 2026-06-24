import type { AuthUser } from '@workspace/auth'

/**
 * 認証ユーザー情報（Cognito / Amplify Auth）
 *
 * 認証ストアの `AuthUser`（`@workspace/auth`）を再利用する。
 */
export type { AuthUser }

/**
 * アプリ上のユーザープロフィール。
 *
 * 実体は Amplify Data（AppSync + DynamoDB）の `User` モデルに対応させる想定。
 * Phase 5 でスキーマ確定後、`Schema['User']['type']` に置き換える。
 */
export interface User {
  id: string
  email: string
  displayName?: string
}
