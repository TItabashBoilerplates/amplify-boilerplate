import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import type { z } from 'zod'
import { users } from './schema/index.ts'

// Insert schemas (Form / API payload 用ベース)
export const usersInsertSchema = createInsertSchema(users)

// Update schemas (PATCH 系で各フィールドを optional 化)
export const usersUpdateSchema = createUpdateSchema(users)

// Select schemas (取得値の型安全用)
export const usersSelectSchema = createSelectSchema(users)

// 推論型 (drizzle 側の InferSelectModel/InferInsertModel と等価だが zod 経由で揃える)
export type UsersInsert = z.infer<typeof usersInsertSchema>
export type UsersUpdate = z.infer<typeof usersUpdateSchema>
export type UsersSelect = z.infer<typeof usersSelectSchema>
