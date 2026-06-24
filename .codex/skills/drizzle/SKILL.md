---
name: drizzle
description: Drizzle ORM database schema management guidance. Use for table definitions, RLS policies (pgPolicy), migrations, and Supabase integration.
---

# Drizzle ORM

This project uses **Drizzle ORM** for database schema management.

## Directory Structure

```
drizzle/
├── drizzle.config.ts         # Drizzle Kit config (out: './migrations')
├── migrate.ts                # pre/post-migration SQL runner (Bun)
├── schema/
│   ├── schema.ts             # Main schema (tables + RLS)
│   ├── types.ts              # Enum definitions
│   └── index.ts              # Public API
├── config/
│   ├── pre-migration/        # SQL run BEFORE generate/migrate (extensions)
│   └── post-migration/       # SQL run AFTER migrate (functions, triggers, realtime)
└── migrations/               # drizzle-kit output (v3 folder format, git-tracked)
```

## Table Definition

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountName: text('account_name').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow(),
}).enableRLS() // Enable RLS
```

## RLS Policy Definition

### Basic Pattern (in same file as table)

```typescript
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Define RLS policies immediately after table
export const users = pgTable('users', {
  // ... column definitions
}).enableRLS()

// SELECT policy: Everyone can view
export const selectOwnUser = pgPolicy('select_own_user', {
  for: 'select',
  to: ['anon', 'authenticated'],
  using: sql`true`,
}).link(users)

// Edit policy: Own data only
export const editPolicyUsers = pgPolicy('edit_policy_users', {
  for: 'all',
  to: 'authenticated',
  using: sql`(select auth.uid()) = id`,
  withCheck: sql`(select auth.uid()) = id`,
}).link(users)
```

### Policy Parameters

| Parameter | Description | Values |
|-----------|-------------|--------|
| **for** | Operation type | `'select'`, `'insert'`, `'update'`, `'delete'`, `'all'` |
| **to** | Target role | `'anon'`, `'authenticated'`, array, `authenticatedRole` |
| **using** | Row visibility condition | `sql` tagged template |
| **withCheck** | INSERT/UPDATE validation | `sql` tagged template |

## Schema Change Workflow

```bash
# 1. Edit schema
vi drizzle/schema/schema.ts

# 2. Generate + apply migration (Local: agent may auto-execute)
devenv tasks run app:migrate-dev

# 3. Type-only regeneration (no migration apply)
devenv tasks run model:build
```

**Migration Execution Policy**:
- **Local** (`app:migrate-dev` / `db:migrate-dev`): agent may auto-execute. Failure is recoverable by editing schema and re-running, or `supabase-stop && supabase-start` to reset local DB.
- **Remote** (`db:migrate-deploy` with `-P staging` / `-P production`): **agent must NOT auto-execute**. Always confirm with the user before applying to shared / production databases. Migrations are irreversible there.

## Type Generation

```bash
# Frontend types (Supabase types + API client + db-schema package)
devenv tasks run model:frontend

# Edge Functions types (Supabase types + Drizzle schema copy)
devenv tasks run model:functions

# All at once
devenv tasks run model:build
```

## Frontend usage of Drizzle-derived zod schemas

The `@workspace/db-schema` package exposes drizzle-zod generated schemas for frontend Form / API validation:

```typescript
import { usersInsertSchema, type UsersInsert } from '@workspace/db-schema/zod'
import { z } from 'zod'

// users table NOT NULL / UNIQUE / max length は自動反映される
export const accountUpdateSchema = usersInsertSchema.pick({
  displayName: true,
  accountName: true,
})

// UI 都合のフィールドは .extend() / .refine() で追加
export const onboardingSchema = accountUpdateSchema.extend({
  agreedToTerms: z.literal(true),
})

export type AccountUpdate = z.infer<typeof accountUpdateSchema>
```

**Prerequisites**:
- `frontend/packages/db-schema/src/schema/` is **auto-generated**（手動編集禁止、`.agent/rules/auto-generated.md` 参照）
- Edit `drizzle/schema/` → `devenv tasks run model:frontend` regenerates zod schemas
- Provided schemas: `usersInsertSchema` / `usersUpdateSchema` / `usersSelectSchema` ほか全テーブル分

## DateTime Column Best Practice

```typescript
timestamp('created_at', {
  withTimezone: true,  // TIMESTAMP WITH TIME ZONE
  precision: 3,        // Millisecond precision (JS Date compatible)
}).notNull().defaultNow()
```
