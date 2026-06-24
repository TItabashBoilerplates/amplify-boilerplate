import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// ===== Users テーブル（RLS付き） =====
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull().default(''),
  accountName: text('account_name').notNull().unique(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    precision: 3,
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    precision: 3,
  })
    .notNull()
    .defaultNow(),
}).enableRLS()

// ===== Users RLS ポリシー =====

// Auth Hook用ポリシー（supabase_auth_admin専用）
export const insertPolicyUsers = pgPolicy('insert_policy_users', {
  for: 'insert',
  to: 'supabase_auth_admin',
  withCheck: sql`true`,
}).link(users)

// 全ユーザーが全usersを閲覧可能
export const selectOwnUser = pgPolicy('select_own_user', {
  for: 'select',
  to: ['anon', 'authenticated'],
  using: sql`true`,
}).link(users)

// 自分のユーザー情報のみ編集可能
export const editPolicyUsers = pgPolicy('edit_policy_users', {
  for: 'all',
  to: 'authenticated',
  using: sql`(SELECT auth.uid()) = id`,
  withCheck: sql`(SELECT auth.uid()) = id`,
}).link(users)

// ===== 型エクスポート =====
export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
