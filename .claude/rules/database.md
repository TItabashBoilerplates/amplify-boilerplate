---
paths: drizzle/**/*.ts, drizzle/migrations/**/*.sql
---

# Database Migration Policy

**ローカル開発のマイグレーションは AI 実行可。本番デプロイは引き続きユーザー承認必須。**

## Rules

| 操作 | 対象 DB | AI 自動実行 | 備考 |
|---|---|---|---|
| `devenv tasks run app:migrate-dev` | **ローカル** Supabase (localhost:54322) | **可** | スキーマ生成 → 適用 → 型再生成。失敗してもローカルなので安全に再実行可能 |
| `devenv tasks run db:migrate-dev` | **ローカル** Supabase | **可** | 上記から型生成を除いたサブセット |
| `devenv tasks run model:*` | (DB 接続を伴わない型生成) | **可** | 元から read-only |
| `devenv tasks run -P staging db:migrate-deploy` | **共有 staging** | **要承認** | 共有環境への変更。実行前にユーザーへ明示確認 |
| `devenv tasks run -P production db:migrate-deploy` | **本番** | **要承認** | 不可逆かつデータ損失リスクあり。実行前にユーザーへ明示確認 |
| `drizzle/migrations/` 内ファイルの**手動編集** | (生成済み migration) | **禁止** | ハッシュ整合性が壊れる。スキーマ側を直して再 generate する |

## Workflow (Local Development)

```bash
# 1. Edit schema
vi drizzle/schema/schema.ts

# 2. AI が自動実行してよい (ローカル DB のみ)
devenv tasks run app:migrate-dev
# → migrate:pre → drizzle-kit generate → drizzle-kit migrate → migrate:post → model:build

# 3. 生成された migration SQL を確認 (AI / 人間どちらでも)
ls drizzle/migrations/
cat drizzle/migrations/<latest>/migration.sql

# 4. 失敗した場合の復旧
# - エラーログを読む
# - drizzle/schema/*.ts または drizzle/config/post-migration/*.sql を修正
# - 必要なら supabase-stop && supabase-start でローカル DB をリセット
# - 再度 app:migrate-dev
```

## Workflow (Remote Deployment, USER APPROVAL REQUIRED)

```bash
# AI は実行禁止。以下のいずれかでユーザーに確認:
# - 「staging に migration を適用してよいか」
# - 「production に migration を適用してよいか」
# - 「どの profile (staging / production) に対して実行するか」

# ユーザーが実行を承認した場合のみ:
devenv tasks run -P staging db:migrate-deploy
# or
devenv tasks run -P production db:migrate-deploy
```

## Why Local Migrations Can Be Auto-Executed

- ローカル Supabase は Docker コンテナで再起動可能 (`stop && supabase-start`)
- マイグレーションログ (`__drizzle_migrations`) はローカルにしか反映されない
- スキーマ変更 → 型再生成 → テストの流れを止めずに進められる
- 失敗してもデータ損失は開発者個人のローカル DB に限定

## Why Remote Migrations Still Require Approval

- staging / production は **共有システム**（チームメンバーや本番ユーザーに影響）
- データ損失は不可逆
- migration SQL の **目視レビュー**を経てから適用すべき
- 実行タイミング（メンテナンス時間帯など）に配慮が必要

## Schema Design Rules (MANDATORY)

### Primary Key: UUID

**ALWAYS use UUID** for primary keys, not auto-increment integers.

```typescript
// ✅ Correct: UUID primary key
import { uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ...
})

// ❌ Wrong: Auto-increment integer
export const users = pgTable('users', {
  id: serial('id').primaryKey(),  // DO NOT USE
  // ...
})
```

### Benefits of UUID

1. **Security**: IDs are not guessable/sequential
2. **Distributed systems**: No collision when merging data
3. **Privacy**: Doesn't expose record count
4. **Supabase Auth**: Consistent with `auth.users.id` (UUID)

### Foreign Keys

```typescript
// ✅ Correct: UUID foreign key referencing auth.users
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id),
  // ...
})
```

### AmbiguousForeignKeysError の回避 (sqlacodegen)

`sqlacodegen` で SQLModel を自動生成する際、**同じテーブルへの複数の外部キー参照**があると `AmbiguousForeignKeysError` が発生する。

**原因**: sqlacodegen Issue [#376](https://github.com/agronholm/sqlacodegen/issues/376)（未解決）
**発生箇所**: `devenv up` 時の SQLModel 自動生成 (`backend-py/apps/api/src/api/domain/entity/models.py`)

#### 問題のあるパターン

```typescript
// ❌ Wrong: 同じテーブルへの複数の外部キー参照
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id),
  receiverId: uuid('receiver_id').references(() => users.id),
})
// → sqlacodegen が relationship 生成時にどの FK を使うか判断できずエラー
```

#### 推奨パターン A: 中間テーブルで分離

```typescript
// ✅ Correct: 役割ごとに中間テーブルを作成
export const messageSenders = pgTable('message_senders', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id),
  userId: uuid('user_id').references(() => users.id),
})

export const messageReceivers = pgTable('message_receivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id),
  userId: uuid('user_id').references(() => users.id),
})
```

#### 推奨パターン B: 単一参照に限定

```typescript
// ✅ Correct: 同じテーブルへの参照は1つのみ
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').references(() => users.id), // 1つだけ
})

// 受信者は別テーブルで管理
export const messageRecipients = pgTable('message_recipients', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id),
  userId: uuid('user_id').references(() => users.id),
})
```

#### やむを得ず複数参照が必要な場合

```typescript
// ⚠️ 注意: sqlacodegen でエラーの可能性あり
// backend-py 側で手動対応が必要になる場合がある
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
})
```

---

## RLS Policy Design Rules (MANDATORY)

### No Helper Functions

**NEVER create PostgreSQL helper functions for RLS policies.**
All RLS logic MUST be defined inline within `drizzle/schema/*.ts` using `pgPolicy`.

```typescript
// ✅ Correct: Inline SQL in pgPolicy
export const selectOwnUser = pgPolicy('select_own_user', {
  for: 'select',
  to: 'authenticated',
  using: sql`(SELECT auth.uid()) = id`,
}).link(users)

// ✅ Correct: EXISTS subquery for related table checks
export const selectPolicyMessages = pgPolicy('select_policy_messages', {
  for: 'select',
  to: 'authenticated',
  using: sql`
    EXISTS (
      SELECT 1
      FROM user_chats
      WHERE user_chats.chat_room_id = messages.chat_room_id
      AND user_chats.user_id = (SELECT auth.uid())
    )
  `,
}).link(messages)

// ❌ Wrong: Using helper functions
CREATE FUNCTION is_owner(user_id uuid) RETURNS boolean AS $$
  SELECT user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

export const selectPolicy = pgPolicy('select_policy', {
  for: 'select',
  using: sql`is_owner(user_id)`,  // DO NOT USE helper functions
}).link(myTable)
```

### Why No Helper Functions?

1. **Single Source of Truth**: All RLS logic is visible in `drizzle/schema/`
2. **Version Control**: Policies are tracked with schema changes
3. **Debugging**: No hidden function logic to trace
4. **Migration Safety**: Functions require separate management and can become orphaned
5. **Transparency**: Security logic is explicit and reviewable

### RLS Definition Location

| Component | Location |
|-----------|----------|
| Table definition | `drizzle/schema/*.ts` |
| RLS enablement | `.enableRLS()` on table |
| Policy definition | `pgPolicy(...)` in same file |
| Policy linking | `.link(tableName)` |

### Common Patterns

```typescript
// Pattern 1: Direct user ID comparison
using: sql`(SELECT auth.uid()) = user_id`

// Pattern 2: EXISTS with related table
using: sql`
  EXISTS (
    SELECT 1 FROM related_table
    WHERE related_table.id = current_table.foreign_id
    AND related_table.owner_id = (SELECT auth.uid())
  )
`

// Pattern 3: Service role only (admin operations)
to: 'supabase_auth_admin',
withCheck: sql`true`

// Pattern 4: Public read access
to: ['anon', 'authenticated'],
using: sql`true`
```

---

## Enforcement

- **ローカル**: AI が `app:migrate-dev` / `db:migrate-dev` を自動実行してよい。失敗時はエラーログ確認 → スキーマまたは pre/post SQL の修正 → 再実行のループで自走可能。
- **本番 / staging**: AI は `db:migrate-deploy` を実行しない。ユーザーに明示確認をしてから手動実行。
