import type { User as SupabaseUser } from '@supabase/supabase-js'

export type AuthUser = SupabaseUser

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
