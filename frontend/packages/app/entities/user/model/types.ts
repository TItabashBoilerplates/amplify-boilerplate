/**
 * ユーザーエンティティの型定義
 *
 * Web/Native間で共有されるユーザー関連の型
 */

import type { User as SupabaseUser } from '@supabase/supabase-js'

/**
 * アプリケーション内で使用するユーザー型
 */
export interface AppUser {
  id: string
  email: string | undefined
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
}

/**
 * SupabaseユーザーからAppUserへの変換
 */
export function toAppUser(supabaseUser: SupabaseUser): AppUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    displayName: supabaseUser.user_metadata?.display_name ?? null,
    avatarUrl: supabaseUser.user_metadata?.avatar_url ?? null,
    createdAt: new Date(supabaseUser.created_at),
  }
}
