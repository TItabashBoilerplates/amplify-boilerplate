---
title: RLS のパフォーマンス検証（EXPLAIN / pg_stat_statements）
category: performance
priority: HIGH
---

# Performance Verification

RLS を追加・変更した後は **必ず計測する**。勘や見た目では判断できない。ツールは 3 つ:

1. `EXPLAIN (ANALYZE, BUFFERS)` — 単一クエリの実行計画
2. `pg_stat_statements` — 集計された遅いクエリの検出
3. `pgTAP` + ベンチマーク — RLS の挙動テストと回帰防止

## 1. `EXPLAIN (ANALYZE, BUFFERS)` — 基本の一手

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM products WHERE brand_id = '11111111-1111-1111-1111-111111111111';
```

**確認ポイント**（上から順に重要）:

### (a) `InitPlan` が `auth.uid()` をキャッシュしているか

```
✅ GOOD:
  InitPlan 1 (returns $0)
    ->  Result  (cost=0.00..0.01 rows=1)
  ->  Index Scan using products_brand_id_idx on products
        Filter: (brand_id = $0)
```

`InitPlan` が見える = `(SELECT auth.uid())` がちゃんとキャッシュされている証拠。

`InitPlan` がない = `auth.uid()` を素で使っている可能性大 → `auth-patterns.md` を参照して修正。

### (b) スキャンタイプ

| タイプ | 評価 | 意味 |
|-------|------|------|
| `Index Scan` / `Index Only Scan` | ✅ GOOD | インデックスで絞っている |
| `Bitmap Index Scan` | ✅ OK | 多数の行を絞る場合、ビットマップ経由 |
| `Seq Scan` | ❌ BAD（通常） | 全行スキャン。RLS 対象テーブルでは致命的 |

例外: 数百行程度の小さいテーブルでは Seq Scan の方が速い。1,000 行超でテーブルが大きいのに Seq Scan → インデックス追加を検討。

### (c) 実行時間

```
Execution Time: 0.123 ms   ← 良い
Execution Time: 12.456 ms  ← 要注意（RLS 起点の可能性）
Execution Time: 123.456 ms ← 問題あり
```

Supabase RLS 最適化の実例（公式）:
- `auth.uid()` 素 → `(SELECT auth.uid())`: 179ms → 9ms
- インデックスなし → あり: 171ms → <0.1ms
- EXISTS JOIN → SECURITY DEFINER: 11,000ms → 7ms

### (d) `Buffers` で I/O 量を見る

```
Buffers: shared hit=3 read=0  ← ✅ メモリキャッシュから取得
Buffers: shared hit=12 read=4800  ← ❌ ディスクから大量読み込み
```

`read` が大きいときは:
- インデックスがない → 追加
- インデックスはあるが選択性が悪い → 複合インデックスか部分インデックスを検討
- 統計が古い → `ANALYZE <table>` 実行

### (e) `Rows Removed by Filter`

```
Rows Removed by Filter: 999000  ← ❌ 100万行スキャンして 1000 行残す = 非効率
```

RLS の filter が 大量の行を除外している = インデックスで先に絞れていない。RLS 述語で使う列にインデックスを追加する。

## 2. 認証コンテキストでの `EXPLAIN` 実行

RLS は JWT / ロールで挙動が変わる。**本番と同じ認証コンテキストで計測する** こと。

### Supabase Studio（SQL Editor）

Supabase Dashboard の SQL Editor には **Role switcher** があり、`authenticated` ロールに切り替えて実行できる。

### psql / ローカル環境

```sql
-- 特定ユーザーとして実行するコンテキストを作る
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated","aal":"aal1"}';

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM products WHERE brand_id = '...';

RESET role;
```

### pgTAP + EXPLAIN 組み合わせ（CI でリグレッション検出）

```sql
-- supabase/tests/rls_perf_products.sql
begin;
select plan(1);

select tests.authenticate_as('alice');

-- 実行時間が閾値を超えないことを検証
select ok(
  (
    SELECT (EXTRACT(ms FROM (SELECT now() - clock_timestamp())))
    -- 実用では psql \timing / pg_stat_statements で計測
  ),
  'products query under 50ms'
);

select * from finish();
rollback;
```

実用的には **pg_stat_statements** で継続監視する方が楽（下記）。

## 3. `pg_stat_statements` — 継続監視

Supabase では `pg_stat_statements` 拡張がデフォルト有効。遅いクエリの自動検出に使う。

```sql
-- 拡張有効化確認
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 遅い SELECT クエリ TOP 10（平均時間順）
SELECT
  substring(query, 1, 80) AS query,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM pg_stat_statements
WHERE query ILIKE 'SELECT%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**RLS 起点の遅いクエリの見つけ方**:
1. `mean_exec_time` が大きいクエリを抽出
2. クエリを `EXPLAIN ANALYZE` で再実行
3. プランに `auth.uid()` / `SELECT ... FROM auth.users` / 再帰 JOIN が見えたら RLS が原因

### Supabase Dashboard の Query Performance

Supabase Dashboard → Reports → Query Performance で同じ情報を GUI 確認可能。

## 4. `Index Advisor`（Supabase 公式拡張）

Supabase は `index_advisor` 拡張を提供。特定クエリに対して **推奨インデックス** を提案してくれる。

```sql
CREATE EXTENSION IF NOT EXISTS index_advisor;

SELECT * FROM index_advisor(
  'SELECT * FROM products WHERE brand_id = $1'
);
-- 推奨: CREATE INDEX ON public.products USING btree (brand_id);
```

## 5. 計測の定番ワークフロー

```
1. 新しい RLS ポリシー or 変更を加える
   ↓
2. 代表的なクエリを EXPLAIN (ANALYZE, BUFFERS) で実行
   - authenticated ロールで
   - 代表的なデータボリューム（小・中・大）で
   ↓
3. InitPlan / Index Scan / 実行時間をチェック
   ↓
4. 悪ければ rls/ の該当リファレンスに従って修正
   - auth.uid() ラップ → auth-patterns.md
   - インデックス不足 → indexes-for-rls.md
   - 再帰 JOIN → security-definer-functions.md
   ↓
5. pg_stat_statements で本番環境でも遅いクエリが出ていないか継続監視
```

## 6. パフォーマンスアンチパターンの検出チェック

実行計画に以下が見えたら要注意:

| シグナル | 原因の可能性 |
|---------|-------------|
| `InitPlan` なしで `auth.uid()` が複数回実行 | `auth.uid()` を `(SELECT ...)` でラップしていない |
| `Seq Scan` on 大きいテーブル | RLS 対象カラムにインデックスなし |
| `Nested Loop` の反復数が大きい | 再帰 RLS（参照先テーブルの RLS 評価） |
| `SubPlan` 内で同じテーブルが複数回 | nested select で RLS 個別評価 |
| `Filter` で `Rows Removed` が非常に大きい | インデックスで絞れずに RLS で削っている |
| `Buffers: read` が大きい | キャッシュ外れ。統計古い or インデックス不足 |

## チェックリスト

- [ ] RLS 追加・変更時に `EXPLAIN (ANALYZE, BUFFERS)` で計測した
- [ ] 実行計画に `InitPlan` が見えている
- [ ] 大きいテーブルで `Index Scan` が使われている（`Seq Scan` でない）
- [ ] `pg_stat_statements` で遅いクエリが継続的に発生していない
- [ ] pgTAP で RLS の挙動を検証（機能面）
- [ ] 統計更新（`ANALYZE`）を定期実行（Supabase は auto-analyze あり）

## 参考

- [PostgreSQL: EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)
- [PostgreSQL: pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [Supabase: Query Performance](https://supabase.com/docs/guides/platform/performance)
- [Supabase: index_advisor](https://supabase.com/docs/guides/database/extensions/index_advisor)
- [GaryAustin1/RLS-Performance](https://github.com/GaryAustin1/RLS-Performance) — Supabase 公式が参照する **RLS ベンチマークの正規 repo**（InitPlan / auth.uid() wrap / TO / filter / security definer / minimize joins の再現可能計測）
- 本プロジェクトの関連スキル: `supabase-postgres-best-practices/references/monitor-explain-analyze.md`, `monitor-pg-stat-statements.md`
