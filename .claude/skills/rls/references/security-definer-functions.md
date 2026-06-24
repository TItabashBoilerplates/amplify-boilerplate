---
title: SECURITY DEFINER 関数で再帰 RLS を排除する
category: security + performance
priority: CRITICAL
---

# SECURITY DEFINER Functions

RLS 内の `EXISTS` JOIN は **参照先テーブルの RLS も再帰評価** される。これが 3 段以上になると爆発的に遅くなる。SECURITY DEFINER 関数に切り出して **RLS バイパス + initPlan キャッシュ** で 7〜26倍の高速化が得られる（公式: 11,000ms → 7ms の実例あり）。

ただし **SECURITY DEFINER は RLS を完全にバイパスする** ため、関数自体がセキュリティ境界になる。雑に書くと権限昇格バグが生まれる。

## 1. 何が問題か（再帰 RLS）

```sql
-- products の SELECT ポリシー（組織メンバーなら見える）
CREATE POLICY "..." ON products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM brands b
    JOIN org_members om ON om.org_id = b.org_id
    WHERE b.id = products.brand_id AND om.user_id = (SELECT auth.uid())
  ));

-- 各行評価時に発生する再帰評価:
-- 1. products のこの行を見せるか判定
-- 2. brands への SELECT 権限を brands の RLS で評価
-- 3. org_members への SELECT 権限を org_members の RLS で評価
-- → 3 テーブル分の RLS 評価 × 全行
```

子テーブル（product_media, product_variants, ...）まで同じパターンで書くと **N * 3 倍** のコストに膨れ上がる。

## 2. SECURITY DEFINER 関数に切り出す

関数内は **関数所有者の権限で実行 = RLS バイパス**。JOIN のコストだけで済む。

```sql
CREATE OR REPLACE FUNCTION public.is_org_member_of_brand(p_brand_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER   -- RLS をバイパス（必須）
STABLE             -- 同トランザクション内でキャッシュ（必須）
SET search_path = public, pg_temp   -- search_path injection 防止（必須）
AS $$
  SELECT EXISTS (
    SELECT 1 FROM brands b
    JOIN org_members om ON om.org_id = b.org_id
    WHERE b.id = p_brand_id
      AND om.user_id = (SELECT auth.uid())
  );
$$;

-- 実行権限を必要最小ロールに絞る（必須）
REVOKE EXECUTE ON FUNCTION public.is_org_member_of_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member_of_brand(uuid) TO authenticated;

-- ポリシー側も `(SELECT ...)` でラップ
CREATE POLICY "member_read_products" ON products FOR SELECT TO authenticated
  USING ((SELECT public.is_org_member_of_brand(brand_id)));

CREATE POLICY "member_read_media" ON product_media FOR SELECT TO authenticated
  USING ((SELECT public.is_org_member_of_brand(
    (SELECT brand_id FROM products WHERE id = product_media.product_id)
  )));
```

## 3. 必須の 5 要件

PostgreSQL + Supabase 公式の要件をすべて満たすこと:

| # | 要件 | 理由 |
|---|------|------|
| 1 | `SECURITY DEFINER` | RLS をバイパス（目的） |
| 2 | `SET search_path = public, pg_temp` | 悪意のユーザーが `pg_temp` に同名関数/テーブルを仕込んでハイジャックするのを防ぐ |
| 3 | `STABLE`（書き込みなし時）/ `IMMUTABLE`（引数のみに依存） | initPlan / 式キャッシュを有効化 |
| 4 | 関数内で `(SELECT auth.uid())` 等の認可チェック | RLS バイパスするため関数自体が認可責務を持つ |
| 5 | `REVOKE ... FROM PUBLIC` + `GRANT EXECUTE TO <role>` | 不要ロール（anon 等）への実行を塞ぐ |

### なぜ `search_path = public, pg_temp` か

PostgreSQL 公式は `SET search_path = admin, pg_temp` のような「**信頼できるスキーマ + pg_temp 最後**」を推奨:
> "Include `pg_temp` as last entry ... forces temporary schema last (normally searched first)"

`pg_temp` を省略すると Postgres は自動で先頭に追加する。先頭に来ると攻撃者が一時テーブル/関数で関数本体をハイジャック可能になる。**末尾に明示指定**することで先頭挿入を防ぐ。

`search_path = ''`（空）でも可だが、関数本体の全参照を `public.brands` のようにスキーマ修飾する必要がある。実用性のバランスで **`public, pg_temp`** が定番。

## 4. STABLE vs IMMUTABLE vs VOLATILE

| マーカー | 意味 | 使いどころ |
|---------|------|-----------|
| `IMMUTABLE` | 引数のみに依存、DB アクセスなし | 純関数（数値/文字列変換） |
| `STABLE` | 単一 SQL 内で同じ入力に同じ結果、DB 読み取り OK | **RLS ヘルパー関数の既定** |
| `VOLATILE`（デフォルト） | 毎回異なる結果可（書き込み、`random()` 等） | 最適化されない — RLS で使うな |

**重要**: マーカーを省略すると VOLATILE 扱い = initPlan キャッシュが効かない。必ず `STABLE` を明示。

詳細は `function-volatility.md` 参照。

## 5. `LEAKPROOF` について（Supabase Cloud では使えない）

`LEAKPROOF` 関数は RLS 述語よりも先に評価される（pushdown 可能）ため、さらに高速化する。

```sql
CREATE FUNCTION is_org_member(p_org_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE LEAKPROOF
  SET search_path = public, pg_temp
  AS $$ ... $$;
```

ただし PostgreSQL 公式:
> "Only superuser can mark functions LEAKPROOF"

**Supabase Cloud では `postgres` ロールが superuser ではない** ため、`LEAKPROOF` を付けられない。Self-hosted で superuser 権限がある場合のみ活用可能。

## 6. Drizzle での扱い

現状 Drizzle には SECURITY DEFINER 関数の DSL がないため、`drizzle/config/post-migration/` に SQL で記述する。

```sql
-- drizzle/config/post-migration/
CREATE OR REPLACE FUNCTION public.is_org_member_of_brand(p_brand_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM brands b
    JOIN org_members om ON om.org_id = b.org_id
    WHERE b.id = p_brand_id
      AND om.user_id = (SELECT auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_member_of_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member_of_brand(uuid) TO authenticated;
```

Drizzle の pgPolicy から参照:

```typescript
import { sql } from 'drizzle-orm'
import { pgPolicy } from 'drizzle-orm/pg-core'

pgPolicy('member_read_products', {
  for: 'select',
  to: 'authenticated',
  using: sql`(select public.is_org_member_of_brand(brand_id))`,
})
```

## 7. 短絡評価パターン（複数経路の許可判定）

PERMISSIVE ポリシー複数定義は OR で結合されるが短絡評価されない。SECURITY DEFINER 関数内で `IF/RETURN` で明示的に短絡する:

```sql
CREATE OR REPLACE FUNCTION public.can_read_product(p_product_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
DECLARE
  v_is_public boolean;
  v_brand_id uuid;
BEGIN
  -- 短絡 1: 公開商品なら JOIN なしで即許可
  SELECT is_public, brand_id INTO v_is_public, v_brand_id
  FROM products WHERE id = p_product_id;

  IF v_is_public THEN
    RETURN true;
  END IF;

  -- 短絡 2: authenticated でなければ不許可
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN false;
  END IF;

  -- 最後に重い JOIN
  RETURN EXISTS (
    SELECT 1 FROM brands b
    JOIN org_members om ON om.org_id = b.org_id
    WHERE b.id = v_brand_id
      AND om.user_id = (SELECT auth.uid())
  );
END;
$$;

CREATE POLICY "read_product" ON products FOR SELECT TO anon, authenticated
  USING ((SELECT public.can_read_product(id)));
```

## 8. 禁止パターン

```sql
-- ❌ search_path 未設定（injection 脆弱性）
CREATE FUNCTION f() SECURITY DEFINER AS $$ ... $$;

-- ❌ VOLATILE（キャッシュ効かない）
CREATE FUNCTION f() SECURITY DEFINER AS $$ ... $$;  -- マーカーなし = VOLATILE

-- ❌ 関数内で認可チェックなし（誰でも全データ取得可能）
CREATE FUNCTION get_all_users() RETURNS setof users
  SECURITY DEFINER AS $$ SELECT * FROM users $$;

-- ❌ PUBLIC 実行権限を残す
CREATE FUNCTION f() SECURITY DEFINER AS $$ ... $$;
-- （REVOKE FROM PUBLIC を忘れる）

-- ❌ ポリシー側で (SELECT ...) ラップを忘れる
CREATE POLICY "..." USING (is_org_member(org_id));  -- 行ごと評価
-- ✅ USING ((SELECT is_org_member(org_id)))
```

## チェックリスト

- [ ] `SECURITY DEFINER` + `STABLE`（または `IMMUTABLE`）
- [ ] `SET search_path = public, pg_temp`（`pg_temp` 末尾必須）
- [ ] 関数内に `(SELECT auth.uid())` を使った認可チェックがある
- [ ] `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO <role>`
- [ ] ポリシーから呼ぶ際は `(SELECT fn(...))` でラップ
- [ ] 関数定義は `drizzle/config/post-migration/` に配置
- [ ] pgTAP で関数の正しさ + ポリシーの挙動を検証

## 参考

- [PostgreSQL: CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) — SECURITY DEFINER / search_path / STABLE / LEAKPROOF の正式仕様
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions) — Supabase での書き方・推奨パターン
- [PostgreSQL: Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY) — 安全な書き方
