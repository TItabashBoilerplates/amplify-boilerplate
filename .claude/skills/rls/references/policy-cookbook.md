---
title: RLS ポリシー・レシピ集（コピペ可能なテンプレート）
category: patterns
priority: HIGH
---

# Policy Cookbook

公式 Supabase RLS ドキュメント（[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)）の canonical example に、本プロジェクトの方針（`(SELECT auth.uid())` ラップ必須、`TO` ロール明示必須、`raw_app_meta_data` のみ認可に使用）を適用したコピペ可能テンプレート集。

**使い方**: 要件に最も近いパターンを選び、カラム名・テーブル名だけ置き換えて使う。独自に書き起こさない。

---

## 1. Owner-Only（所有者のみ）— 4 オペレーション完全形

公式 Supabase 例をそのまま適用（`profiles` テーブルで `user_id` が所有者）:

```sql
-- SELECT
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- INSERT
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE（USING + WITH CHECK 両方必須 — なりすまし書き換え防止）
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

Drizzle:

```typescript
export const profiles = pgTable('profiles', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  // ...
}, (table) => [
  index('profiles_user_id_idx').on(table.userId),
]).enableRLS()

pgPolicy('profiles_select_own', {
  for: 'select', to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
}).link(profiles)

pgPolicy('profiles_insert_own', {
  for: 'insert', to: 'authenticated',
  withCheck: sql`(select auth.uid()) = user_id`,
}).link(profiles)

pgPolicy('profiles_update_own', {
  for: 'update', to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
  withCheck: sql`(select auth.uid()) = user_id`,
}).link(profiles)

pgPolicy('profiles_delete_own', {
  for: 'delete', to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
}).link(profiles)
```

**出典**: [Supabase: Row Level Security — Owner example](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## 2. Public Read + Own Write（誰でも読める、本人のみ書ける）

公式 Supabase 例（`to anon using ( true )`）をベースに:

```sql
-- 誰でも読める
CREATE POLICY "posts_public_read" ON public.posts FOR SELECT TO anon, authenticated
  USING (true);

-- 本人のみ作成可能
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id);

-- 本人のみ更新・削除
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK ((SELECT auth.uid()) = author_id);

CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = author_id);
```

**ポイント**: `to anon, authenticated` を明示的に両方指定。`true` は anon にも認証済みにも同じ挙動。

---

## 3. Authenticated-Only Read（ログインユーザーのみ閲覧）

公式 Supabase 例そのまま:

```sql
CREATE POLICY "posts_auth_read" ON public.posts FOR SELECT TO authenticated
  USING (true);
```

`anon` を含めないことで未認証ユーザーはそもそもポリシー評価対象外 → **公式ベンチマーク: anon アクセス 170ms → <0.1ms**。

---

## 4. Organization Membership（組織メンバーのみ）— JWT `app_metadata`

公式 Supabase 例（team membership via `app_metadata`）をそのまま適用:

```sql
CREATE POLICY "docs_team_member" ON public.documents FOR SELECT TO authenticated
  USING (team_id IN (
    SELECT jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'teams')::uuid
  ));
```

**ポイント**:
- `app_metadata.teams` は `service_role` からしか書けない不可変 claim（認可安全）
- JWT 配列を展開する書き方は PostgreSQL の `jsonb_array_elements_text` を使う
- ユーザーの所属 team を変更する場合、`supabase.auth.refreshSession()` を呼ばせないと JWT 内の teams が更新されない

**出典**: [Supabase: Row Level Security — Team membership via app_metadata](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## 5. Organization Membership（DB 参照版）— 即時反映が必要な場合

JWT の `app_metadata` 更新には token 再発行が必要（最大 JWT 有効期限分のラグ）。
即時反映が必要なら、DB テーブルを参照する SECURITY DEFINER ヘルパー関数を使う。

```sql
-- ヘルパー関数（drizzle/config/post-migration/）
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = (SELECT auth.uid())
      AND status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- ポリシー
CREATE POLICY "docs_org_member" ON public.documents FOR SELECT TO authenticated
  USING ((SELECT public.is_org_member(org_id)));
```

詳細は `security-definer-functions.md` 参照。

---

## 6. Role-Based Admin（`app_metadata.role` で権限判定）

```sql
-- 通常ユーザー: 自分の orgs のみ
CREATE POLICY "orgs_member_read" ON public.orgs FOR SELECT TO authenticated
  USING ((SELECT public.is_org_member(id)));

-- admin: 全 org 閲覧可能（PERMISSIVE 追加）
CREATE POLICY "orgs_admin_read" ON public.orgs FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

`PERMISSIVE` は OR で結合されるので、どちらか一方が true なら読める。

---

## 7. MFA（AAL2）Required — RESTRICTIVE パターン

公式 Supabase 例そのまま:

```sql
-- 通常の PERMISSIVE ポリシー（読める条件）
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- RESTRICTIVE: UPDATE は MFA 必須（AND 結合、さらに絞る）
CREATE POLICY "profiles_update_requires_mfa" ON public.profiles FOR UPDATE TO authenticated
  AS RESTRICTIVE
  USING ((SELECT auth.jwt() ->> 'aal') = 'aal2');
```

`aal` claim: `aal1` = password のみ、`aal2` = MFA 済み。
PERMISSIVE だけでは全員読めてしまう要件に、RESTRICTIVE で追加の必須条件を AND する。

**出典**: [Supabase: RLS — RESTRICTIVE MFA example](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## 8. Shared via ACL Table（明示的共有）

共有関係を別テーブル（`document_shares`）で管理する場合:

```sql
-- 共有テーブル
CREATE TABLE public.document_shares (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('read', 'write')),
  expires_at timestamptz,
  PRIMARY KEY (document_id, user_id)
);
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
CREATE INDEX document_shares_user_id_idx ON public.document_shares (user_id);

-- SECURITY DEFINER 関数で共有判定
CREATE OR REPLACE FUNCTION public.has_document_access(
  p_document_id uuid,
  p_required_permission text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    -- 所有者
    SELECT 1 FROM public.documents
    WHERE id = p_document_id
      AND owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    -- 共有されている
    SELECT 1 FROM public.document_shares
    WHERE document_id = p_document_id
      AND user_id = (SELECT auth.uid())
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        p_required_permission = 'read'
        OR permission = 'write'  -- 'write' は read も暗黙的に許可
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_document_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_document_access(uuid, text) TO authenticated;

-- ポリシー
CREATE POLICY "docs_read_shared" ON public.documents FOR SELECT TO authenticated
  USING ((SELECT public.has_document_access(id, 'read')));

CREATE POLICY "docs_write_shared" ON public.documents FOR UPDATE TO authenticated
  USING ((SELECT public.has_document_access(id, 'write')))
  WITH CHECK ((SELECT public.has_document_access(id, 'write')));
```

**ポイント**:
- 所有者判定と共有判定を関数内で一括化（短絡評価可能）
- `expires_at` で時間制限付き共有を同時に実現
- `permission` 階層（write ⊇ read）を関数ロジックで表現

---

## 9. Soft Delete + RLS（論理削除）

Realtime の DELETE RLS バイパス問題（`realtime-rls.md`）の回避にも有効:

```typescript
export const messages = pgTable('messages', {
  id: uuid().primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull(),
  content: text().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
}, (table) => [
  // 未削除のみを対象とする部分インデックス（indexes-for-rls.md 参照）
  index('messages_channel_active_idx')
    .on(table.channelId)
    .where(sql`${table.deletedAt} IS NULL`),
]).enableRLS()
```

```sql
-- SELECT: 未削除 かつ メンバー
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (SELECT public.is_channel_member(channel_id))
  );

-- DELETE を禁止 — 代わりに UPDATE で deleted_at をセット
REVOKE DELETE ON public.messages FROM authenticated;  -- そもそも DELETE できなくする

-- UPDATE: 自分のメッセージのみ（deleted_at セットも含む）
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK ((SELECT auth.uid()) = author_id);
```

**ポイント**: 物理 DELETE を `REVOKE DELETE` で完全にブロック。物理削除は `service_role` 経由のバッチで定期実行。

---

## 10. Hierarchical Access（親子関係）

`project` 所有者 + メンバーが、配下の `tasks` にアクセスできるパターン:

```sql
-- ヘルパー: プロジェクトへのアクセス可否を判定
CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = (SELECT auth.uid())
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO authenticated;

-- projects テーブル: 所有者または project_members に所属
CREATE POLICY "projects_access" ON public.projects FOR ALL TO authenticated
  USING ((SELECT public.has_project_access(id)))
  WITH CHECK ((SELECT public.has_project_access(id)));

-- tasks テーブル: 親 project にアクセスできるなら tasks も見える
CREATE POLICY "tasks_inherit_project_access" ON public.tasks FOR SELECT TO authenticated
  USING ((SELECT public.has_project_access(project_id)));

CREATE POLICY "tasks_insert_to_accessible_project" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_project_access(project_id)));

CREATE POLICY "tasks_update_in_accessible_project" ON public.tasks FOR UPDATE TO authenticated
  USING ((SELECT public.has_project_access(project_id)))
  WITH CHECK ((SELECT public.has_project_access(project_id)));
```

**ポイント**:
- 権限ロジックを親テーブル（`projects`）に集約、子（`tasks`）からは関数呼び出しで再利用
- 関数に SECURITY DEFINER + STABLE で再帰 RLS 評価を排除

---

## 11. pgvector RAG with RLS（公式 Supabase パターン）

Supabase 公式の [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions) ドキュメントに基づく二段構成:

```typescript
// drizzle/schema/documents.ts
export const documents = pgTable('documents', {
  id: uuid().primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => authUsers.id),
  title: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
}, (table) => [
  index('documents_owner_id_idx').on(table.ownerId),
]).enableRLS()

export const documentSections = pgTable('document_sections', {
  id: uuid().primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  content: text().notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
}, (table) => [
  index('document_sections_document_id_idx').on(table.documentId),
]).enableRLS()
```

```sql
-- documents: 所有者のみ
CREATE POLICY "documents_select_own" ON public.documents FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- document_sections: 親 document にアクセスできるもの
CREATE POLICY "document_sections_via_document" ON public.document_sections FOR SELECT TO authenticated
  USING (document_id IN (
    SELECT id FROM public.documents WHERE owner_id = (SELECT auth.uid())
  ));
```

**似た用途なら SECURITY DEFINER 関数に切り出して initPlan 化** することでさらに速くなる（複数子テーブルがある場合）。

ベクトル類似検索:

```sql
-- RLS は similarity search にも自動適用される
SELECT id, content, embedding <#> query_vector AS distance
FROM public.document_sections
WHERE embedding <#> query_vector < -0.5
ORDER BY embedding <#> query_vector
LIMIT 10;
```

公式ドキュメント:
> "Every select query executed on `document_sections` will implicitly filter the returned sections based on whether or not the current user has access to them."

**注意**（公式）:
> "PostgREST does not currently support pgvector similarity operators"

→ フロントから直接 `supabase.from('document_sections').select(...)` で類似検索はできない。SECURITY DEFINER 関数でラップして `supabase.rpc()` で呼び出す。

```sql
-- RPC 関数
CREATE OR REPLACE FUNCTION public.search_sections(p_query vector(1536), p_limit int DEFAULT 10)
RETURNS TABLE (id uuid, content text, distance float)
LANGUAGE sql SECURITY INVOKER STABLE   -- INVOKER: RLS を効かせる
SET search_path = public, pg_temp
AS $$
  SELECT
    ds.id,
    ds.content,
    (ds.embedding <#> p_query)::float AS distance
  FROM public.document_sections ds
  WHERE ds.embedding <#> p_query < -0.5
  ORDER BY ds.embedding <#> p_query
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.search_sections(vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_sections(vector, int) TO authenticated;
```

**重要**: pgvector ラッパー関数は `SECURITY INVOKER`（デフォルト）にすることで呼び出し元の RLS が効く。ここで `SECURITY DEFINER` にすると RLS バイパスになるので、pgvector + RLS では **INVOKER** を選ぶ。

---

## 共通チェックリスト

どのパターンを使うときも必ず確認:

- [ ] すべての `auth.uid()` / `auth.jwt()` を `(SELECT ...)` でラップ
- [ ] すべてのポリシーに `TO` ロール明示（`anon` / `authenticated` / 特定ロール）
- [ ] UPDATE ポリシーに `USING` + `WITH CHECK` 両方
- [ ] RLS で参照する列（`user_id`, `team_id`, `org_id`, FK 等）にインデックス
- [ ] SECURITY DEFINER 関数には `SET search_path = public, pg_temp` と `STABLE`
- [ ] `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO <role>`
- [ ] pgTAP で 4 象限（anon / self / other / service_role）× 4 オペレーション = 16 ケース検証（→ `testing-rls.md`）

## 参考

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — 公式パターン集（本 cookbook の元）
- [Supabase: RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions) — pgvector + RLS 公式パターン
- [Supabase: MFA / AAL](https://supabase.com/docs/guides/auth/auth-mfa) — `aal` claim の詳細
