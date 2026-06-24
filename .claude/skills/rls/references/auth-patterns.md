---
title: auth.uid() / auth.jwt() 参照パターンと JWT claims
category: security + performance
priority: HIGH
---

# Auth Patterns

RLS 内で「誰が」の判定に使える関数は **`auth.uid()`** と **`auth.jwt()`** の2つ。両方とも **`(SELECT ...)` でラップ必須**。

## 1. `auth.uid()` の必須ラップ

| パターン | 評価コスト |
|---------|-----------|
| `auth.uid() = user_id` | **行ごとに関数呼び出し**（遅い） |
| `(SELECT auth.uid()) = user_id` | **initPlan で1回だけ評価してキャッシュ** |

公式ベンチマーク（1M 行テーブル）:
- Basic case: 179ms → 9ms（94.97% 改善）
- With admin function + join: 11,000ms → 7ms
- Complex OR logic: 11,000ms → 10ms
- Role checking: 178,000ms → 12ms

## 2. `auth.jwt()` も同じく `(SELECT ...)` でラップ

`auth.jwt()` は JWT 全体を返すため呼び出しコストが `auth.uid()` より高い。ラップ必須。

```sql
-- ❌ BAD: 行ごとに JWT パース
USING (auth.jwt() ->> 'tenant_id' = tenant_id);

-- ✅ GOOD: initPlan でキャッシュ
USING ((SELECT auth.jwt() ->> 'tenant_id') = tenant_id);

-- ✅ GOOD: app_metadata を使う（認可に使える不可変フィールド）
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id') = tenant_id);
```

## 3. `auth.uid()` vs `auth.jwt() ->> 'sub'`

どちらも同じ値（ユーザー ID）を返すが:

| 使い分け | 推奨 |
|---------|------|
| 通常の認可判定 | `auth.uid()` 一択（読みやすい） |
| Storage `storage.foldername` でテキスト比較 | `auth.jwt() ->> 'sub'`（テキスト型のまま使える） |
| 複数 claim をまとめて参照 | `auth.jwt() -> 'app_metadata'` |

```sql
-- Storage でパス比較するときは text 型で取得
CREATE POLICY "avatar_owner" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );
```

## 4. `raw_app_meta_data` のみ認可に使う（重要）

| claim | 変更可否 | 認可に使えるか |
|-------|---------|---------------|
| `raw_user_meta_data` | **ユーザーが自由に変更可能** | ❌ 絶対禁止 |
| `raw_app_meta_data` | ユーザーは変更不可（service_role のみ） | ✅ OK |

```sql
-- ❌ SECURITY HOLE: user_metadata を権限判定に使用
USING ((SELECT auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
-- 攻撃例: supabase.auth.updateUser({ data: { role: 'admin' } }) で誰でも管理者化

-- ✅ CORRECT: app_metadata を使う
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- app_metadata は service_role からしか書けない
```

### app_metadata の更新方法

Edge Function / backend-py から:

```typescript
// ✅ service_role 経由で更新
const { error } = await adminClient.auth.admin.updateUserById(userId, {
  app_metadata: { role: 'admin', tenant_id: 'acme' },
})
```

**注意**: JWT は即時更新されない。クライアント側で `supabase.auth.refreshSession()` を呼ばないと新 claim が RLS に反映されない。即時反映が必要な権限は DB テーブル参照の RLS（`profiles.is_admin` など）にする。

## 5. `auth.users` を RLS で JOIN するな

Supabase Auth 内部テーブル `auth.users` は:
- RLS 設定なし（auth スキーマ全体）
- カラム構成が Supabase バージョンで変化
- `email` などの PII を含む

RLS で `auth.users` を JOIN すると、パフォーマンス・保守性・PII 漏洩すべてでデメリット。

```sql
-- ❌ BAD: auth.users JOIN
CREATE POLICY "admin_read" ON reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = (SELECT auth.uid()) AND email LIKE '%@admin.com'
  ));

-- ✅ GOOD 1: app_metadata で判定
CREATE POLICY "admin_read" ON reports FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ✅ GOOD 2: 自前の profiles を JOIN（RLS 設定済み）
CREATE POLICY "admin_read" ON reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  ));
```

**推奨**: `public.profiles (id, role, tenant_id, ...)` を auth ユーザー作成時にトリガーで自動作成し、そちらを参照する。

## 6. 多段参照（JWT → 関数 → テーブル）の最適化

組織メンバーシップのような多段判定はヘルパー関数に切り出す（→ `security-definer-functions.md`）。

```sql
-- ✅ 定番パターン: JWT + SECURITY DEFINER 関数
CREATE OR REPLACE FUNCTION has_org_role(p_org_id uuid, p_role text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id
      AND user_id = (SELECT auth.uid())
      AND role = p_role
  );
$$;

CREATE POLICY "org_admin" ON orgs FOR ALL TO authenticated
  USING ((SELECT has_org_role(id, 'admin')))
  WITH CHECK ((SELECT has_org_role(id, 'admin')));
```

## 7. Anonymous（未ログイン）を扱う

`anon` ロールは `auth.uid()` が null を返す。null 判定を含む書き方に注意。

```sql
-- ❌ BAD: null = null は false（anon に一致しない）
USING (auth.uid() = user_id OR user_id IS NULL);

-- ✅ GOOD: 公開リソースは明示ポリシー、個人リソースは authenticated のみ
CREATE POLICY "public_read" ON posts FOR SELECT TO anon, authenticated
  USING (is_public = true);

CREATE POLICY "own_read" ON posts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

## チェックリスト

- [ ] すべての `auth.uid()` が `(SELECT auth.uid())` でラップされている
- [ ] すべての `auth.jwt()` が `(SELECT auth.jwt())` でラップされている
- [ ] 認可判定に `raw_user_meta_data` を参照していない
- [ ] `raw_app_meta_data` を使う場合、更新経路は `service_role` のみ
- [ ] RLS 内で `auth.users` を JOIN していない（`public.profiles` 等を使う）
- [ ] `anon` 向けポリシーは `TO anon, authenticated` を明示

## 参考

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `auth.uid()` / `auth.jwt()` の説明
- [Supabase: User Management](https://supabase.com/docs/guides/auth/managing-user-data) — `raw_app_meta_data` vs `raw_user_meta_data`
- [Supabase: JWT claims](https://supabase.com/docs/guides/auth/jwts) — Supabase JWT の構造
