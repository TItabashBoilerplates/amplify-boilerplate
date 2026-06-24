---
title: RLS のためのインデックス戦略
category: performance
priority: CRITICAL
---

# Indexes for RLS

公式ベンチマーク: **171ms → <0.1ms（100倍以上の改善）**。RLS で参照するカラムにインデックスがない = 全行スキャン = 致命的に遅い。

## 1. RLS 参照カラムには必ずインデックス

```sql
-- RLS 内で参照するカラムに btree インデックス
CREATE POLICY "own" ON posts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX posts_user_id_idx ON posts USING btree (user_id);
```

Drizzle:

```typescript
import { index } from 'drizzle-orm/pg-core'

export const posts = pgTable('posts', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  orgId: uuid('org_id'),
  status: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
}, (table) => [
  index('posts_user_id_idx').on(table.userId),  // RLS 用
  index('posts_org_id_idx').on(table.orgId),   // RLS 用
]).enableRLS()
```

## 2. FK 列は常にインデックスを貼る

Postgres は FK 制約を自動でインデックス化しない。FK 先を JOIN する RLS で Seq Scan の原因になる。

```sql
-- products.brand_id (FK → brands.id) → 必ずインデックス
CREATE INDEX products_brand_id_idx ON products (brand_id);

-- org_members.org_id, org_members.user_id → 両方インデックス
CREATE INDEX org_members_org_id_idx ON org_members (org_id);
CREATE INDEX org_members_user_id_idx ON org_members (user_id);
```

よくある漏れ: `created_by` / `updated_by` / `owner_id` — PK ではないが RLS で参照する UUID 列。

## 3. 複合インデックス — 複数列 RLS の最適化

RLS が複数条件を `AND` で評価する場合、**複合インデックス** が最速。

```sql
-- RLS: 組織メンバー AND アクティブ状態
CREATE POLICY "..." ON documents FOR SELECT TO authenticated
  USING (
    (SELECT is_org_member(org_id))
    AND status = 'active'
  );

-- 複合インデックス（カーディナリティが高い列を先に）
CREATE INDEX documents_org_status_idx ON documents (org_id, status);
```

**列順のルール**:
1. 等価条件（`=`）を先、範囲条件（`<`, `>`）を後
2. カーディナリティ（値のバリエーション）が高い列を先
3. RLS でほぼ必ず評価される列を先

## 4. 部分インデックス — 絞り込み条件が決まっているとき

RLS や頻出クエリに特定条件がある場合、**部分インデックス（partial index）** が空間効率＋速度で有利。

```sql
-- 削除フラグのあるテーブル: 未削除の行だけインデックス
CREATE INDEX posts_active_user_idx ON posts (user_id)
  WHERE deleted_at IS NULL;

-- 公開状態のみ必要な場合
CREATE INDEX products_public_brand_idx ON products (brand_id)
  WHERE is_public = true;
```

Drizzle:

```typescript
import { sql } from 'drizzle-orm'

pgTable('posts', {...}, (table) => [
  index('posts_active_user_idx')
    .on(table.userId)
    .where(sql`${table.deletedAt} IS NULL`),
])
```

## 5. 関数ベースインデックス（JWT claim で絞る場合）

JWT claim で絞る RLS では、JWT 値との比較カラムに関数/式インデックスを検討。

```sql
-- tenant_id が JSONB で格納されている場合の式インデックス
CREATE INDEX users_metadata_tenant_idx ON users ((metadata ->> 'tenant_id'));

-- 大文字小文字を無視した比較
CREATE INDEX users_email_lower_idx ON users (lower(email));
```

## 6. `EXPLAIN ANALYZE` で確認

インデックスが効いているかは必ず計測:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM posts WHERE user_id = '...';

-- ✅ GOOD:  Index Scan using posts_user_id_idx
-- ❌ BAD:   Seq Scan on posts
```

詳細は `performance-verification.md` 参照。

## 7. インデックスを貼りすぎない

インデックスは **INSERT/UPDATE/DELETE を遅くする**。書き込み頻度の高いテーブルで不要な列にインデックスを貼らない。

**トレードオフ判断**:
- 読み取り >> 書き込み → インデックス積極的
- 書き込み多い（イベントログ等） → 必要最小限
- 監視: `pg_stat_user_indexes.idx_scan = 0` は使われていないインデックスの印

```sql
-- 使われていないインデックスを検出
SELECT schemaname, relname, indexrelname
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## 8. covering index（INCLUDE 句）

RLS + SELECT で取得する列が決まっているなら、**covering index** でテーブルアクセスを減らす（Index-Only Scan）。

```sql
CREATE INDEX posts_user_id_include_idx
  ON posts (user_id)
  INCLUDE (title, created_at);
-- → 「user_id で絞って title, created_at だけ返す」クエリがインデックスだけで完結
```

頻出クエリの列が限定的な場合に有効。過剰適用するとインデックスサイズが肥大化するので計測必須。

## チェックリスト

- [ ] RLS で参照するすべてのカラムにインデックスがある
- [ ] FK 列すべてにインデックスがある（自動では貼られない）
- [ ] 複数条件 RLS には複合インデックスを検討
- [ ] 論理削除（`deleted_at IS NULL`）など常時フィルタには部分インデックス
- [ ] `EXPLAIN ANALYZE` で Index Scan が使われていることを確認
- [ ] `pg_stat_user_indexes.idx_scan = 0` のインデックスは削除検討

## 禁止パターン

```sql
-- ❌ RLS 用カラムなのにインデックスなし
CREATE POLICY "..." ON huge_table USING ((SELECT auth.uid()) = user_id);
-- user_id にインデックスがないと 1M 行でも Seq Scan

-- ❌ FK なのにインデックスなし
foreign_id uuid REFERENCES parent(id),  -- 自動インデックスは作られない

-- ❌ 使われないインデックス放置（書き込み劣化の原因）
```

## 参考

- [PostgreSQL: Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL: Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL: Index-Only Scans](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)
- [Supabase: Index Advisor](https://supabase.com/docs/guides/database/extensions/index_advisor)
- 本プロジェクトの関連スキル: `supabase-postgres-best-practices/references/query-missing-indexes.md`, `query-composite-indexes.md`, `query-partial-indexes.md`, `query-covering-indexes.md`, `schema-foreign-key-indexes.md`
