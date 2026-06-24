---
title: 関数の Volatility と LEAKPROOF
category: performance
priority: HIGH
---

# Function Volatility for RLS

RLS ヘルパー関数を書くときに **Volatility マーカー**（VOLATILE / STABLE / IMMUTABLE）を間違えると、initPlan キャッシュが効かずパフォーマンスが崩壊する。デフォルトは **VOLATILE（最悪）** なので必ず明示する。

## 1. 3 つのマーカー

PostgreSQL 公式の定義:

| マーカー | 定義 | DB 読み取り | DB 書き込み | planner 最適化 |
|---------|------|-----------|-----------|---------------|
| `IMMUTABLE` | 同じ引数 → 常に同じ結果（DB アクセスなし） | ❌ | ❌ | 定数畳み込み可能。インデックス式に使える |
| `STABLE` | 単一 SQL 内で同じ引数 → 同じ結果（DB 読み取り OK） | ✅ | ❌ | initPlan キャッシュ、pushdown 可能 |
| `VOLATILE`（デフォルト） | 同じ引数でも結果が変わりうる | ✅ | ✅ | **最適化されない。行ごとに毎回実行** |

> PostgreSQL 公式: "VOLATILE ... will be evaluated afresh for each row"
> "STABLE ... returns the same result ... within a single table scan"
> "IMMUTABLE ... always return the same result given the same argument values"

## 2. RLS ヘルパー関数は `STABLE` 一択

**RLS 内で呼び出す判定関数はほぼ例外なく `STABLE`**。理由:

- DB を読み取る（`org_members` などを参照）→ `IMMUTABLE` は不可
- 単一クエリ内で結果が変わらない（同じユーザー・同じリソース ID なら同じ結果）
- initPlan / pushdown で1回だけ評価される

```sql
-- ✅ GOOD: STABLE を明示
CREATE FUNCTION is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE                              -- 必須
SET search_path = public, pg_temp
AS $$ ... $$;

-- ❌ BAD: マーカーなし = VOLATILE → 行ごとに実行
CREATE FUNCTION is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$ ... $$;
```

### Drizzle からの呼び出し側

Drizzle には SECURITY DEFINER 関数の DSL がないので、関数自体は `drizzle/config/post-migration/` に書き、pgPolicy から `(select ...)` でラップして呼ぶ。

```typescript
pgPolicy('org_read', {
  for: 'select',
  to: 'authenticated',
  using: sql`(select public.is_org_member(org_id))`,  // initPlan 化
})
```

## 3. IMMUTABLE を使うケース

DB アクセスがない純関数のみ。RLS で直接呼ぶことは少ないが、インデックス式に使いたい場合に有効。

```sql
-- 例: 大文字小文字を無視した email ハッシュ
CREATE FUNCTION normalize_email(e text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT lower(trim(e)) $$;

-- インデックス式に使える
CREATE INDEX users_normalized_email_idx ON users (normalize_email(email));
```

**注意**: 少しでも DB を参照したら IMMUTABLE を名乗るのは嘘。`STABLE` にする。

## 4. VOLATILE が必要な関数（RLS では使わない）

- `random()`, `uuid_generate_v4()`
- `setval()` などの書き込みを伴う関数
- `now()` の代わりに `clock_timestamp()` を使う関数（時刻を進める必要があるとき）

**ルール**: VOLATILE 関数を RLS 内で呼ばない。呼ぶなら SECURITY DEFINER ラッパー内で制御下に置く。

## 5. `LEAKPROOF`（Supabase Cloud では使用不可）

`LEAKPROOF` 関数は **RLS 述語よりも先に評価可能** で、さらに高速化できる。

PostgreSQL 公式の挙動:

```
通常のクエリ（非 LEAKPROOF 関数を WHERE に含む）:
1. RLS ポリシーを先に評価（データ漏洩防止）
2. 非 LEAKPROOF 関数を後で評価

LEAKPROOF 関数を含むクエリ:
1. LEAKPROOF 関数を先に評価可能（pushdown）
2. RLS ポリシー評価
→ 選択的 WHERE で先に絞り込めるのでインデックス活用しやすい
```

### ただし制約あり

PostgreSQL 公式:
> "Only superuser can mark functions LEAKPROOF"

**Supabase Cloud では `postgres` ロールが superuser ではない** ため、カスタム関数に `LEAKPROOF` を付けることはできない。

**使える環境**:
- Self-hosted Postgres + superuser 権限がある
- Supabase Self-hosted（Docker）で superuser としてマイグレーション実行可能な場合

**LEAKPROOF にする条件**（付ける場合）:
- 引数値をエラーメッセージに含めない
- 引数値で条件分岐してエラーを投げない
- 副作用なし
- 「述語を先に評価されても情報漏洩しない」ことを人間が保証

## 6. `PARALLEL SAFE`（大規模クエリの並列実行）

SECURITY DEFINER 関数を RLS で多用する場合、`PARALLEL SAFE` も検討。Postgres が並列実行を検討できるようになる（`PARALLEL RESTRICTED` / `PARALLEL UNSAFE` は並列化されない）。

```sql
CREATE FUNCTION is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$ ... $$;
```

**条件**: 関数内で一時テーブル操作、SEQUENCE 操作、トランザクション制御等がないこと。RLS ヘルパー関数は通常安全。

## 7. 意思決定フロー

```
Q1: 関数は DB にアクセスするか？
├─ No  → IMMUTABLE（インデックス式や定数計算）
└─ Yes → Q2: 同じ引数なら単一クエリ内で同じ結果か？
         ├─ Yes → STABLE（RLS ヘルパー関数の定番）
         └─ No  → VOLATILE（RLS では使わない）

Q3（任意）: 並列化を許容するか？
└─ 副作用・一時リソースがなければ PARALLEL SAFE を追加
```

## チェックリスト

- [ ] すべての RLS ヘルパー関数に `STABLE` / `IMMUTABLE` マーカーが明示されている
- [ ] VOLATILE の関数を RLS 内で呼んでいない
- [ ] DB を読み取る関数は `STABLE`（`IMMUTABLE` と混同しない）
- [ ] `SET search_path = public, pg_temp` もセットで設定
- [ ] Self-hosted で superuser 権限があれば、適切な関数に `LEAKPROOF` 検討
- [ ] 副作用のない関数には `PARALLEL SAFE` を付ける

## 禁止パターン

```sql
-- ❌ マーカー未指定（VOLATILE 扱い = 行ごとに実行）
CREATE FUNCTION is_org_member(p_org_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER AS $$ ... $$;

-- ❌ DB 読むのに IMMUTABLE（嘘で将来バグる）
CREATE FUNCTION is_admin(p_user_id uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = p_user_id)
$$;  -- admins テーブルが変われば結果が変わるのに IMMUTABLE を主張

-- ❌ VOLATILE を RLS で使う
CREATE POLICY "..." USING ((SELECT random()) < 0.5);  -- 意味不明
```

## 参考

- [PostgreSQL: Function Volatility Categories](https://www.postgresql.org/docs/current/xfunc-volatility.html)
- [PostgreSQL: CREATE FUNCTION — LEAKPROOF](https://www.postgresql.org/docs/current/sql-createfunction.html) — LEAKPROOF と superuser 制約
- [PostgreSQL: Parallel Safety](https://www.postgresql.org/docs/current/parallel-safety.html)
