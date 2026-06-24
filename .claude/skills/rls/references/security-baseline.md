---
title: Security Baseline — RLS 有効化・bypassrls・JWT claims
category: security
priority: CRITICAL
---

# Security Baseline（RLS の土台）

RLS の正しい挙動は「**全テーブルで RLS 有効 + `service_role` キーの露出ゼロ + 認可用 claim の正しい選択**」という土台の上に成り立つ。ここが崩れると下位のポリシー最適化は無意味。

## 1. `public` スキーマの全テーブルで RLS を有効化

Supabase 公式:
> "RLS _must_ always be enabled on any tables stored in an exposed schema."

Dashboard 経由で作成したテーブルは自動有効だが、Drizzle/SQL で作ったものは **明示的に有効化必須**。

```typescript
// drizzle/schema/*.ts
export const posts = pgTable('posts', {...}).enableRLS() // 必須
```

```sql
-- RLS 無効テーブルを検出する監査クエリ
SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false;  -- RLS 無効なテーブル
-- 結果が空になるまで運用しない
```

## 2. ポリシー未定義 = 全拒否

RLS 有効化だけ行ってポリシーを一つも作らないと、**そのテーブルへの全操作が拒否** される（`service_role` を除く）。
「`enableRLS()` したのに読めない」→ ポリシー不足が原因。

## 3. `FORCE ROW LEVEL SECURITY`

デフォルトでは **テーブル所有者（= 作成ロール）は RLS をバイパス** する。Supabase Cloud では通常 `postgres` ロールが所有者となり、DB 関数や Edge Function から `postgres` 接続すると RLS が効かない。

```sql
-- テーブル所有者にも RLS を強制する
ALTER TABLE public.posts FORCE ROW LEVEL SECURITY;
```

**いつ使うか**:
- PII/金銭/コンプライアンス対象テーブル
- 所有者ロールで接続するバッチ処理があるプロジェクト

**使わないとき**:
- マイグレーション時のシード投入がブロックされるため、シード時は一時的に `NO FORCE` にするか `service_role` で投入する

## 4. `service_role` キーの扱い

`service_role` は **RLS を完全にバイパス** する。漏れたら全データが読み書き自由になる。

| 環境 | 使用可否 |
|------|---------|
| フロントエンド（Next.js client / React Native） | ❌ 絶対禁止 |
| Next.js Server Component / Server Action | ⚠️ 原則禁止（RLS で足りるなら使うな） |
| Supabase Edge Function | ✅ `service_role` が必要な処理のみ |
| backend-py | ✅ `service_role` が必要な処理のみ |
| Realtime / supabase-js anon clients | ❌ 絶対禁止 |

環境変数命名ルール:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key（クライアント公開 OK）
- `SUPABASE_SERVICE_ROLE_KEY` — `NEXT_PUBLIC_` プレフィックス禁止

Edge Function / backend-py でも、可能な限り **ユーザーの JWT を forward** して RLS を効かせる方が安全。

## 5. `bypassrls` 属性は慎重に

`service_role` 以外のロールに `bypassrls` を付けるのは原則禁止。

```sql
-- ❌ 原則禁止: RLS バイパス権限の拡散
ALTER ROLE my_role WITH BYPASSRLS;
```

Supabase 公式:
> "You should _never_ share login credentials for any Postgres Role with this privilege."

## 6. JWT claim の使い分け — `raw_app_meta_data` のみ認可に使う

Supabase 公式:
- `raw_user_meta_data` — **ユーザー自身が変更可能** → 認可に使うな
- `raw_app_meta_data` — ユーザーは変更不可 → **認可に使う**

```sql
-- ❌ BAD: user_meta_data をベースに権限判定（ユーザーが自由に書き換えられる）
CREATE POLICY "admin_only" ON posts FOR ALL TO authenticated
  USING ((SELECT auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ✅ GOOD: app_metadata をベースに権限判定（不可変）
CREATE POLICY "admin_only" ON posts FOR ALL TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

**補足**: JWT は常に最新ではない。`app_metadata` を更新しても、既発行トークンが期限切れになるまで反映されない。即時反映が必要なら DB テーブルを参照する RLS にする。

## 7. `auth.users` を RLS 内で JOIN するな

`auth.users` は Supabase Auth の内部テーブル。RLS 内で JOIN すると:
- パフォーマンス劣化（auth スキーマは RLS なしだが大きい）
- Supabase Auth のスキーマ変更で壊れるリスク
- `email` などの PII が間接露出するリスク

```sql
-- ❌ BAD
CREATE POLICY "..." ON posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = (SELECT auth.uid()) AND email LIKE '%@admin.com'
  ));

-- ✅ GOOD: app_metadata を JWT から直接参照
CREATE POLICY "..." ON posts FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ✅ GOOD: 自前の profiles テーブルを JOIN（RLS 設定済み）
CREATE POLICY "..." ON posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin
  ));
```

## チェックリスト

- [ ] `public` スキーマの全テーブルで `row security = true`
- [ ] PII/コンプラ対象テーブルは `FORCE ROW LEVEL SECURITY`
- [ ] `service_role` キーがフロント環境変数に漏れていない（`NEXT_PUBLIC_*` にないか確認）
- [ ] 認可判定は `raw_app_meta_data` のみ参照（`raw_user_meta_data` は参照禁止）
- [ ] RLS 内で `auth.users` を JOIN していない
- [ ] `bypassrls` 属性を持つロールが `service_role` / `supabase_admin` のみ

## 参考

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- [PostgreSQL: ALTER ROLE](https://www.postgresql.org/docs/current/sql-alterrole.html) — `BYPASSRLS` 属性
- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) — `FORCE ROW LEVEL SECURITY`
