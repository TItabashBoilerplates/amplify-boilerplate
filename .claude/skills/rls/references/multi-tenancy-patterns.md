---
title: マルチテナント設計（B2B SaaS・大規模）
category: patterns + scale
priority: HIGH
---

# Multi-Tenancy Patterns

B2B SaaS の RLS 設計は「テナント分離の **正しさ**」と「テナント数増加に対する **性能のスケール**」の両方で決まる。間違えると後で直せない。

## 3 つの選択肢

| モデル | データ構造 | 規模目安 | 強み | 弱み |
|-------|-----------|---------|------|------|
| **A. 単一 DB + `tenant_id` 列 + RLS** | 全テーブルに `tenant_id` | 〜数千テナント | シンプル、コスト低、移行容易 | テーブルが混在、巨大化したときクエリ選択性が命 |
| **B. A + マテリアライズド所属** | `tenant_id` + `user_tenant_access` キャッシュ | 数千〜数万 | RLS が高速、JOIN 削減 | 所属変更時のキャッシュ更新が必要 |
| **C. Schema-per-tenant** | テナントごとに別スキーマ | 数十〜数百（巨大テナント） | 完全分離、個別チューニング可 | マイグレーション複雑、Supabase での運用難 |

**本プロジェクトのデフォルト**: A（`tenant_id` + RLS + JWT `app_metadata`）を基本とし、スケール問題が実測で出たら B を検討。C は原則使わない（ユーザー確認必須）。

---

## パターン A: `tenant_id` 列 + JWT `app_metadata`

### スキーマ設計

```typescript
// drizzle/schema/_tenant.ts（すべてのテナント所有テーブルで import）
export const tenantIdColumn = uuid('tenant_id').notNull()

// drizzle/schema/orders.ts
export const orders = pgTable('orders', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: tenantIdColumn,
  userId: uuid('user_id').notNull(),
  amount: numeric({ precision: 12, scale: 2 }),
  // ...
}, (table) => [
  // RLS 用複合インデックス（必須）
  index('orders_tenant_user_idx').on(table.tenantId, table.userId),
  index('orders_tenant_id_idx').on(table.tenantId),  // tenant 単独クエリ用
]).enableRLS()
```

### JWT に `tenant_id` を入れる

ユーザー登録時 / テナント切替時に `service_role` で `app_metadata` を更新:

```typescript
// Edge Function (service_role を使用)
await adminClient.auth.admin.updateUserById(userId, {
  app_metadata: {
    tenant_id: 'acme',       // 現在選択中のテナント
    tenants: ['acme', 'foo'],  // 所属テナント一覧
    role: 'member',
  },
})
```

クライアントは再認証（`supabase.auth.refreshSession()`）で新 JWT を受け取る。

### RLS ポリシー

```sql
-- 1 テナント所属の典型ケース
CREATE POLICY "orders_tenant_isolation" ON public.orders FOR SELECT TO authenticated
  USING (tenant_id::text = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 複数テナント所属ケース: 所属リスト全体
CREATE POLICY "orders_any_member_tenant" ON public.orders FOR SELECT TO authenticated
  USING (
    tenant_id::text = ANY(
      SELECT jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'tenants')
    )
  );
```

**注意**: 型キャストを合わせる（`tenant_id` が uuid、JWT は text）。

### クライアント側も明示的に `tenant_id` フィルタ

RLS 任せにすると Seq Scan になりやすい。**必ず `eq('tenant_id', ...)` を付ける** → 公式ベンチマーク 171ms → 9ms（94.74% 改善）。

```typescript
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', currentTenantId)  // 必須
  .order('created_at', { ascending: false })
  .limit(50)
```

---

## パターン B: マテリアライズド所属テーブル

数万ユーザー × 数万テナントになると、RLS で JWT 参照だけでは **JOIN / JSONB 展開コスト** が問題になる。**所属関係を専用テーブルにキャッシュ** して、PK lookup だけで判定可能にする。

### スキーマ

```typescript
// drizzle/schema/user_tenant_access.ts
export const userTenantAccess = pgTable('user_tenant_access', {
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: text().notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.tenantId] }),
  index('uta_user_id_idx').on(table.userId),      // user → tenants
  index('uta_tenant_id_idx').on(table.tenantId),  // tenant → users
]).enableRLS()
```

### SECURITY DEFINER ヘルパー

```sql
CREATE OR REPLACE FUNCTION public.has_tenant_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenant_access
    WHERE tenant_id = p_tenant_id
      AND user_id = (SELECT auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_tenant_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_access(uuid) TO authenticated;
```

### ポリシー

```sql
CREATE POLICY "orders_tenant_access" ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.has_tenant_access(tenant_id)));
```

**メリット**:
- JWT 再発行不要で所属変更が即時反映
- PK lookup（複合 PK `(user_id, tenant_id)`）で 0.1ms 以下
- ロールも同時管理できる

**コスト**: 所属変更時に `user_tenant_access` を更新するオペレーションが必要（`service_role` の Edge Function で書き込み）。

---

## パターン C: Schema-per-tenant（要ユーザー承認）

Supabase では推奨されないアプローチ。超大規模テナント（数十社が各自数千万レコード）で個別チューニング / バックアップを分離したいとき。

```sql
CREATE SCHEMA tenant_acme;
CREATE TABLE tenant_acme.orders (...);
-- テナントごとに全テーブル複製
```

**問題点**:
- Drizzle のスキーマ管理が複雑
- `supabase-js` でスキーマ指定必須（`createClient(..., { db: { schema: 'tenant_acme' } })`）
- マイグレーション適用が N 倍
- Supabase 管理画面で横串集計が不可能

**判断**: このパターンを採用したい場合、**ユーザーに必ず確認**。通常は A/B で済む。

---

## JWT 再発行の race condition

`raw_app_meta_data` を更新しても、**既発行の JWT が期限切れになるまで RLS に反映されない**（Supabase JWT のデフォルトは 1 時間）。

| シナリオ | 問題 | 対処 |
|---------|------|------|
| 退会したユーザーが旧 JWT でアクセス | 最大 JWT 有効期限ぶん残権限 | `user_tenant_access` を削除 + パターン B（DB 参照）に切替、または JWT 有効期限を短縮 |
| 権限昇格直後 | 新権限が効かない | クライアントで `supabase.auth.refreshSession()` を呼ぶ |
| 権限剥奪 | 即時剥奪できない | パターン B + 剥奪時に `user_tenant_access` を DELETE |

**教訓**: **即時性が要求される権限は DB 参照（パターン B）を使う**。JWT `app_metadata` は「通常運用で十分」なキャッシュとして使う。

---

## アクティブテナント切替（複数所属ユーザー）

1 ユーザーが複数テナントに所属する場合、**「今どのテナントのデータを見ているか」** を扱う方法:

### 選択肢 1: クライアント状態 + フィルタ

```typescript
const { currentTenantId } = useActiveTenant()  // Zustand 等

const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', currentTenantId)
// RLS は「所属のいずれか」で許可、実際の絞り込みはクライアント側フィルタ
```

RLS: 「所属の **どれか** なら許可」

```sql
CREATE POLICY "..." ON orders FOR SELECT TO authenticated
  USING ((SELECT public.has_tenant_access(tenant_id)));
```

### 選択肢 2: `app_metadata.current_tenant` を更新して JWT 再発行

```typescript
// テナント切替時
await supabase.functions.invoke('switch-tenant', { body: { tenantId } })
// Edge Function が app_metadata.tenant_id を更新
await supabase.auth.refreshSession()  // 新 JWT 取得
```

RLS: 「アクティブテナントのみ許可」

```sql
CREATE POLICY "..." ON orders FOR SELECT TO authenticated
  USING (tenant_id::text = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
```

**選択指針**:
- 切替頻度が高い（タブ切替感覚） → 選択肢 1
- 切替が稀（別セッション的な体験） → 選択肢 2

---

## クロステナント管理（プラットフォーム admin）

SaaS 運営側の admin が全テナントのデータを見る必要があるケース:

```sql
-- 通常ユーザー: 所属テナントのみ
CREATE POLICY "orders_tenant_access" ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.has_tenant_access(tenant_id)));

-- platform admin: 全テナント閲覧可能（追加 PERMISSIVE で OR）
CREATE POLICY "orders_platform_admin" ON public.orders FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin'
  );
```

**注意**: `platform_role` は `service_role` からしか書けない `app_metadata` 列で管理。誤って通常ユーザーが admin 化するのを防ぐ。

監査ログが必要なら SECURITY DEFINER 関数 + `audit_log` テーブル（`column-level-security.md` の RPC パターン参照）。

---

## 規模別意思決定フロー

```
Q1: テナント数は何桁？
├─ ~100: パターン A（tenant_id + JWT）で十分
├─ 100〜10,000: パターン A から開始、pg_stat_statements 監視
├─ 10,000〜100,000: パターン B（マテリアライズド所属）を検討
└─ 100,000+: パターン B + パーティショニング（tenant_id による LIST）も検討

Q2: テナント間でデータサイズに極端な偏りがある？（1テナントで全体の 50%+）
└─ Yes → パターン C（schema-per-tenant）を「巨大テナントのみ」に適用
         ユーザー確認必須
```

---

## チェックリスト

- [ ] すべてのテナント所有テーブルに **`tenant_id` 列 + NOT NULL + インデックス**
- [ ] `tenant_id` は JWT `raw_app_meta_data` 経由、**`user_metadata` 経由ではない**
- [ ] クライアント側で `.eq('tenant_id', ...)` を必ず付ける（RLS 任せにしない）
- [ ] 権限の即時剥奪が必要なら **パターン B**（`user_tenant_access` DB 参照）
- [ ] テナント間 FK を張らない（テナント境界をまたぐ参照は避ける）
- [ ] platform admin を使う場合、`app_metadata.platform_role` を `service_role` のみ書き込み可能に
- [ ] pgTAP で「別テナントのデータが絶対に見えない」テストを 4 オペレーション分すべて検証

## 禁止パターン

```sql
-- ❌ tenant_id にインデックスなし（大きくなると致命的）
CREATE TABLE orders (tenant_id uuid NOT NULL, ...);
-- インデックスを付け忘れている

-- ❌ user_metadata で tenant を判定（ユーザーが改ざん可能）
USING ((auth.jwt() -> 'user_metadata' ->> 'tenant_id') = tenant_id::text);

-- ❌ クロステナントの FK
CREATE TABLE orders (
  tenant_id uuid,
  foreign_tenant_id uuid REFERENCES orders(tenant_id)  -- 境界を壊す
);

-- ❌ RLS 任せのクライアントクエリ
const { data } = await supabase.from('orders').select('*')  // tenant_id フィルタなし
```

## 参考

- [Supabase: Row Level Security — Team membership](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data) — `raw_app_meta_data` vs `raw_user_meta_data`
- [Supabase: JWTs](https://supabase.com/docs/guides/auth/jwts)
- 関連: `auth-patterns.md`, `security-definer-functions.md`, `indexes-for-rls.md`
