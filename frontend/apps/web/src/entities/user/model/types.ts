import type { Tables } from '@workspace/types/schema'

/**
 * Supabase users テーブルの型
 */
export type User = Tables<'users'>

/**
 * 認証ユーザー情報（Supabase Auth）
 */
export interface AuthUser {
  id: string
  email: string | undefined
  emailConfirmedAt: Date | null
  createdAt: Date
}
