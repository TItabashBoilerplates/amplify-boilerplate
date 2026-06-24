---
name: drizzle
description: Drizzle ORM によるデータベーススキーマ管理ガイダンス。テーブル定義、RLSポリシー（pgPolicy）、マイグレーション、Supabase統合についての質問に使用。スキーマ変更ワークフロー、型生成の実装支援を提供。
---

# Drizzle ORM スキル

このプロジェクトは **Drizzle ORM** でデータベーススキーマを管理しています。

## ディレクトリ構成

```
drizzle/
├── drizzle.config.ts         # Drizzle Kit 設定（out: './migrations'）
├── migrate.ts                # pre/post-migration SQL ランナー（Bun）
├── schema/
│   ├── schema.ts             # メインスキーマ（テーブル + RLS）
│   ├── types.ts              # Enum 定義
│   └── index.ts              # Public API
├── config/
│   ├── pre-migration/        # generate/migrate より前に流す SQL（extensions 等）
│   └── post-migration/       # migrate の後に流す SQL（functions/triggers/realtime）
└── migrations/               # drizzle-kit 出力（v3 フォルダ形式、git 管理）
```

## テーブル定義

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
}).enableRLS() // RLS 有効化
```

## RLS ポリシー定義

### 基本パターン（テーブルと同じファイルに配置）

```typescript
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// テーブル定義の直後にRLSポリシーを定義
export const users = pgTable('users', {
  // ... カラム定義
}).enableRLS()

// SELECT ポリシー: 全員閲覧可能
export const selectOwnUser = pgPolicy('select_own_user', {
  for: 'select',
  to: ['anon', 'authenticated'],
  using: sql`true`,
}).link(users)

// 編集ポリシー: 自分のデータのみ
export const editPolicyUsers = pgPolicy('edit_policy_users', {
  for: 'all',
  to: 'authenticated',
  using: sql`(select auth.uid()) = id`,
  withCheck: sql`(select auth.uid()) = id`,
}).link(users)
```

**重要**: `auth.uid()` は必ず `(select auth.uid())` でラップする（initPlan キャッシュで 94.97% 改善）。`to` ロールも必ず明示する。RLS の設計原則・パフォーマンス最適化・SECURITY DEFINER 関数による再帰 RLS 排除など、詳細は **`.claude/skills/rls/SKILL.md` を必ず参照**。

### Supabase 組み込みロールの使用

```typescript
import { authenticatedRole, serviceRole } from 'drizzle-orm/supabase'

export const insertPolicy = pgPolicy('authenticated_insert', {
  for: 'insert',
  to: authenticatedRole,
  withCheck: sql`(select auth.uid()) = user_id`,
}).link(myTable)
```

### ポリシーパラメータ

| パラメータ | 説明 | 値 |
|-----------|------|-----|
| **for** | 操作タイプ | `'select'`, `'insert'`, `'update'`, `'delete'`, `'all'` |
| **to** | 対象ロール | `'anon'`, `'authenticated'`, 配列, `authenticatedRole` |
| **using** | 行の可視性条件 | `sql` タグ付きテンプレート |
| **withCheck** | INSERT/UPDATE の検証条件 | `sql` タグ付きテンプレート |

## スキーマ変更ワークフロー

```bash
# 1. スキーマ編集
vi drizzle/schema/schema.ts

# 2. マイグレーション生成 + 適用（ローカル: AI 自動実行可）
devenv tasks run app:migrate-dev

# 3. 型のみ再生成 (migration 不要時)
devenv tasks run model:build
```

**実行ポリシー** (詳細は `.claude/rules/database.md`):
- **ローカル** (`app:migrate-dev` / `db:migrate-dev`): AI 自動実行可。失敗は schema 修正 → 再実行で復旧可能。
- **本番 / staging** (`db:migrate-deploy`): ⚠️ **AI 自動実行禁止**。共有環境 / 本番への適用は必ずユーザーに確認してから手動実行。

**重要**: マイグレーションは破壊的操作のため、Claude は自動実行しません。

## Enum 定義

```typescript
// schema/types.ts
import { pgEnum } from 'drizzle-orm/pg-core'

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'inactive',
  'suspended',
])

// schema/schema.ts で使用
import { userStatusEnum } from './types'

export const users = pgTable('users', {
  status: userStatusEnum('status').notNull().default('active'),
})
```

## カスタムSQL（pre/post-migration）

カスタム SQL は **2 フェーズ** で `drizzle/config/` 配下に置き、`migrate.ts` (Bun) が `drizzle-kit migrate` の前後で順次実行する。

```sql
-- drizzle/config/pre-migration/00_extensions.sql （generate/migrate より前）
-- pgvector 拡張
CREATE EXTENSION IF NOT EXISTS vector;
```

```sql
-- drizzle/config/post-migration/00_functions.sql （migrate の後）

-- Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- カスタム関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

実行順:
```
nr migrate:pre → nr generate → nr migrate → nr migrate:post
```

## 型生成

```bash
# Frontend 用: Supabase 型 + Drizzle schema コピー (db-schema パッケージへ)
devenv tasks run model:frontend

# Edge Functions 用 (Supabase 型 + Drizzle スキーマコピー)
devenv tasks run model:functions

# 両方一括
devenv tasks run model:build
```

## Frontend での Drizzle 由来 zod schema 利用

`@workspace/db-schema` パッケージ経由で drizzle-zod 生成の zod schema を frontend Form / API validation に使う:

```typescript
import { usersInsertSchema, type UsersInsert } from '@workspace/db-schema/zod'
import { z } from 'zod'

// users テーブルの NOT NULL / UNIQUE / max length が自動反映される
export const accountUpdateSchema = usersInsertSchema.pick({
  displayName: true,
  accountName: true,
})

// オンボーディング: accountName は handle_new_user() トリガーが自動付与する → 入力欄に出さない
export const onboardingSchema = usersInsertSchema
  .pick({ displayName: true })
  .extend({ agreedToTerms: z.literal(true) })

export type AccountUpdate = z.infer<typeof accountUpdateSchema>
```

### DB トリガーで埋まるカラムの扱い (重要)

`drizzle/config/post-migration/00_functions.sql` の `handle_new_user()` で自動付与されるカラム (例: `users.accountName`) は DB 上 NOT NULL だが **アプリ層は送らない**。drizzle-zod は DB 制約通りに required にするため、Form/API payload では `pick` か `omit` で必要なフィールドだけ取り出す:

| シナリオ | パターン |
|---|---|
| サインアップ (OAuth/OTP) | accountName は送らない → schema 含めない |
| Onboarding (初回プロフィール) | `usersInsertSchema.pick({ displayName: true })` |
| アカウント設定変更 | `usersInsertSchema.pick({ displayName: true, accountName: true })` |
| PATCH 部分更新 | `usersUpdateSchema.omit({ id: true })` (PK は path 由来) |

**前提**:
- `frontend/packages/db-schema/src/schema/` は **auto-generated**（手動編集禁止、`.claude/rules/auto-generated.md` 参照）
- drizzle/schema/ を編集 → `devenv tasks run model:frontend` で zod 側も自動再生成
- 提供 schema: `usersInsertSchema` / `usersUpdateSchema` / `usersSelectSchema` ほか全テーブル分（users / userProfiles / subscriptions / orders）

### Edge Functions での使用

Edge Functions で Drizzle ORM と PostgreSQL を使用する場合：

**deno.json 設定（必須）**:
```json
{
  "imports": {
    "drizzle-orm": "npm:drizzle-orm@^0.45.2",
    "drizzle-orm/": "npm:drizzle-orm@^0.45.2/",
    "postgres": "https://deno.land/x/postgresjs@v3.4.8/mod.js"
  }
}
```

**IMPORTANT**: postgres.js は `deno.land/x` からの最新版 `v3.4.8` を使用すること。`npm:postgres` は Deno 環境で互換性問題が発生する可能性がある。

**型のみ使用する場合**:
```typescript
// supabase/functions/example/index.ts
import type { InferSelectModel } from 'drizzle-orm'
import { users } from '../shared/drizzle/index.ts'

type User = InferSelectModel<typeof users>
```

**クエリ実行する場合**:
```typescript
// supabase/functions/shared/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './drizzle/index.ts'

const connectionString = Deno.env.get('SUPABASE_DB_URL')!
const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client, { schema })

// supabase/functions/example/index.ts
import { db } from '../shared/db.ts'
import { users } from '../shared/drizzle/index.ts'
import { eq } from 'drizzle-orm'

const result = await db.select().from(users).where(eq(users.id, userId))
```

## 日時カラムのベストプラクティス

```typescript
timestamp('created_at', {
  withTimezone: true,  // TIMESTAMP WITH TIME ZONE
  precision: 3,        // ミリ秒精度（JSのDateと互換）
}).notNull().defaultNow()
```

詳細: [rls.md](rls.md), [migrations.md](migrations.md)
