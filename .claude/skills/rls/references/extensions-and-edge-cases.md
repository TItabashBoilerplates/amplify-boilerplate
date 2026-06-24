---
title: RLS のバイパスパス・エッジケース・拡張機能との相互作用
category: security + operations
priority: CRITICAL
---

# Extensions and Edge Cases

RLS は **万能のガードではない**。PostgreSQL 公式は複数の RLS バイパスパスを明示しており、これを知らずに使うとデータ漏洩する。本プロジェクトで使う拡張機能（pg_cron, pgvector, Realtime 等）との相互作用も合わせて整理する。

## 1. TRUNCATE は RLS をバイパス（公式仕様）

PostgreSQL 公式:
> "Operations that apply to the whole table, such as `TRUNCATE` and `REFERENCES`, are not subject to row security."

**意味**: `TRUNCATE` 権限を持つロールは、RLS ポリシーに関係なく **テーブル全行を削除** できる。

### 対策

```sql
-- ❌ 危険: authenticated が TRUNCATE 可能なテーブル
GRANT ALL ON public.posts TO authenticated;  -- ALL には TRUNCATE 含む

-- ✅ 必要な権限だけ付与（TRUNCATE は除く）
REVOKE ALL ON public.posts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
-- TRUNCATE は付与しない
```

**Supabase デフォルト**: `authenticated` / `anon` ロールには通常 TRUNCATE 権限は付かない。ただし **カスタムロールを作るときに `GRANT ALL` を使うと漏れる** ので注意。

### 監査クエリ

```sql
-- authenticated / anon に TRUNCATE 権限が付いているテーブルを検出
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('authenticated', 'anon')
  AND privilege_type = 'TRUNCATE';
-- 結果が空であることを確認
```

---

## 2. REFERENCES（外部キー）も RLS をバイパス（公式仕様）

PostgreSQL 公式:
> "Referential integrity checks, such as unique or primary key constraints and foreign key references, always bypass row security to ensure that data integrity is maintained."

**意味**: FK 制約で参照されている行は、RLS で見えない状態でも存在が **間接的に推測可能**。

### 攻撃例

```sql
-- secret_users: RLS で他ユーザーは見えない
CREATE TABLE secret_users (id uuid PRIMARY KEY, ...);

-- posts: FK で secret_users を参照
CREATE TABLE posts (
  id uuid PRIMARY KEY,
  author_id uuid REFERENCES secret_users(id)
);

-- 攻撃: 存在しない ID で INSERT
INSERT INTO posts (author_id) VALUES ('guess-uuid-1');  -- FK violation → 存在しない
INSERT INTO posts (author_id) VALUES ('guess-uuid-2');  -- 成功 → その ID が存在することが判明
```

エラーの有無で `secret_users` の ID の存在が判明する。

### 対策

| 対策 | 内容 |
|------|------|
| **サロゲートキー** | 推測可能な ID（連番、email）を FK に使わず、UUID v4 のようなランダム値を使う |
| **FK を張らない** | 強いテナント境界（別テナントのデータを参照しない）の場合、FK を貼らずアプリ層で整合性確保 |
| **中間テーブル経由** | 直接 FK せず、共有ビューや Edge Function 経由でアクセス |

UUID v4 を PK にする場合、推測攻撃は現実的に不可能（2^122 の空間）なのでほとんどのケースで問題にならない。**ただし連番 ID（`serial` / `bigserial`）を公開 API に露出するのは禁止**。

---

## 3. COPY FROM は RLS テーブルで使えない（公式仕様）

PostgreSQL 公式:
> "Currently, `COPY FROM` is not supported for tables with row-level security. Use equivalent `INSERT` statements instead."
> "If row-level security is enabled for the table, the relevant `SELECT` policies will apply to ``COPY _table_ TO`` statements."

**意味**:
- `COPY TO` は SELECT ポリシーを尊重する（安全）
- `COPY FROM` は RLS テーブルでエラーになる → バルク INSERT したいなら `INSERT ... SELECT` や `UNNEST` を使う

Supabase MCP / psql でバルクデータ投入するとき、RLS 有効テーブルには `COPY FROM` が使えない点に注意。

---

## 4. Superuser / BYPASSRLS / Table Owner の挙動（公式仕様）

PostgreSQL 公式:
> "Superusers and roles with the `BYPASSRLS` attribute always bypass the row security system when accessing a table. Table owners normally bypass row security as well, though a table owner can choose to be subject to row security with [ALTER TABLE ... FORCE ROW LEVEL SECURITY](sql-altertable.html)."

| ロール | RLS バイパス |
|-------|-------------|
| Superuser（`postgres` in self-hosted） | ✅ 常にバイパス |
| `BYPASSRLS` 属性持ち | ✅ 常にバイパス |
| テーブル所有者 | ✅ デフォルトでバイパス |
| テーブル所有者 + `FORCE ROW LEVEL SECURITY` | ❌ バイパスしない |

### 実務影響

- Supabase Cloud では `postgres` が **superuser ではない**（制限付きロール）。ただし大半の権限を持つ
- テーブル所有者は通常 `postgres` なので、**DB 関数・マイグレーションから RLS をすり抜ける**
- PII テーブルには `ALTER TABLE public.foo FORCE ROW LEVEL SECURITY` を検討（`security-baseline.md`）

---

## 5. pg_cron — ジョブ実行ロール

pg_cron 公式:
> "jobs are executed in the database in which the `cron.schedule` function is called with the same permissions as the current user."

**意味**: `cron.schedule()` を呼んだユーザーの権限で実行される = そのユーザーに対する RLS が効く。

### 正しいジョブ設計

```sql
-- ❌ BAD: postgres として schedule → postgres 権限で実行（RLS バイパス）
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *',
  $$ DELETE FROM sessions WHERE expires_at < now() $$
);
-- postgres 権限なので RLS 関係なく全行削除。だが意図と合わないロジックが混ざるリスク

-- ✅ GOOD: SECURITY DEFINER 関数経由で意図的な権限で実行
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER    -- 関数所有者（postgres）として実行
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 期限切れセッションを削除（RLS バイパス意図的）
  DELETE FROM public.sessions WHERE expires_at < now();

  -- 監査ログ
  INSERT INTO public.audit_log (action, metadata)
  VALUES ('cleanup_sessions', jsonb_build_object('deleted_at', now()));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC;

-- ジョブ登録
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *',
  $$ SELECT public.cleanup_expired_sessions() $$
);
```

### `cron.schedule_in_database()` の username パラメータ（pg_cron 公式）

```sql
SELECT cron.schedule_in_database(
  'nightly-report',
  '0 2 * * *',
  $$ SELECT generate_report() $$,
  'postgres',            -- 対象データベース
  'reporting_user'       -- このユーザー権限で実行
);
```

特定ユーザー権限でジョブ実行できる。**そのユーザーに対する RLS が効く** ので、テナント別のメンテナンスジョブを所有者権限で走らせる設計が可能。

### Supabase での pg_cron

Supabase Dashboard の Integrations → Cron で GUI 登録可能。裏側は同じ `cron.schedule`。Supabase の pg_cron は **`postgres` ロールで実行** するのがデフォルトなので、上記の SECURITY DEFINER 関数経由パターンを採用する。

---

## 6. pgvector — 類似検索と RLS

Supabase 公式 [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions) より:
> "Every select query executed on `document_sections` will implicitly filter the returned sections based on whether or not the current user has access to them."

RLS は pgvector の類似検索（`<->`, `<#>`, `<=>` 演算子）にも自動適用される。

### PostgREST の制約（公式）

> "PostgREST does not currently support pgvector similarity operators"

フロントから `supabase.from('document_sections').select('*')` で類似検索の WHERE を書けない。**必ず RPC 関数でラップ** し、`supabase.rpc()` で呼ぶ。

### SECURITY INVOKER を選ぶ（重要）

pgvector ラッパー関数は **`SECURITY INVOKER`（デフォルト）** にすること。`SECURITY DEFINER` にすると RLS バイパスになる。

```sql
-- ✅ GOOD: SECURITY INVOKER（明示、またはデフォルト）
CREATE OR REPLACE FUNCTION public.search_documents(p_query vector(1536), p_limit int DEFAULT 10)
RETURNS TABLE (id uuid, content text, distance float)
LANGUAGE sql
SECURITY INVOKER   -- 呼び出し元の RLS が効く
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id, content, (embedding <#> p_query)::float
  FROM public.document_sections
  WHERE embedding <#> p_query < -0.5
  ORDER BY embedding <#> p_query
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.search_documents(vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_documents(vector, int) TO authenticated;
```

**SECURITY DEFINER にする例外**: 組織共有ドキュメントの横断検索で、関数内に「組織メンバーシップ」の独自認可チェックを実装する場合。その場合は `security-definer-functions.md` のパターンに従う。

### ベクトルインデックス（ivfflat / hnsw）

- RLS は SELECT 時のフィルタなので、インデックスは **通常通り効く**
- ただし RLS で大量の行が除外される場合、ベクトルインデックスの利得が減る
- **テナント別に部分インデックス** を検討:

```sql
-- 例: 特定テナントでよく検索する場合
CREATE INDEX document_sections_acme_hnsw
  ON public.document_sections USING hnsw (embedding vector_cosine_ops)
  WHERE tenant_id = 'acme-uuid';
```

---

## 7. Realtime Postgres Changes — DELETE は RLS バイパス

再掲（`realtime-rls.md` 参照）: Supabase Realtime の `postgres_changes` で **DELETE イベントは RLS が適用されない**。PII を含むテーブルで `event: '*'` を使うとデータ漏洩の可能性。

対策は `realtime-rls.md` の章参照（論理削除 / `event: 'INSERT' | 'UPDATE'` のみ購読 / PII 分離）。

---

## 8. 宣言的パーティショニング + RLS

**PostgreSQL 公式は RLS と宣言的パーティショニングの相互作用を明確に文書化していない**（RLS docs / Partitioning docs / CREATE POLICY docs すべてで未言及）。

したがって以下は **公式記載なしの実務指針**であり、採用前に **pgTAP で実測検証** すること:

**実務指針（検証推奨）**:
- 宣言的パーティションでは、**ポリシーは parent table と partition の両方に定義できる**
- parent に定義したポリシーが partition に継承されるかは PostgreSQL のバージョン依存の可能性あり
- **安全な方針**: parent + 各 partition の両方に同じポリシーを設定する
- あるいは、ポリシーを SECURITY DEFINER 関数に集約し、parent / partition の双方から同じ関数を呼ぶ

### pgTAP で検証

```sql
-- 採用前に必ず検証
select tests.authenticate_as('alice');
select results_eq(
  $$ select id from public.partitioned_orders where tenant_id = 'bob_tenant' $$,
  $$ values () $$::bigint,
  'alice cannot see bob tenant rows through partitioned parent'
);
-- 各 partition に対しても同様のテスト
```

**本プロジェクトの方針**: パーティショニングが必要なほどのスケールになるまで RLS との併用は慎重に。必要になったらユーザーに判断をあおぐ。

---

## 9. `statement_timeout` — 暴走 RLS クエリの封じ込め

PostgreSQL 公式:
- デフォルト: 0（無制限）
- 単位なしは milliseconds

### Supabase でのロール別設定（推奨）

Supabase の内部ロール（`authenticated`, `anon`, `service_role`, `postgres`）に個別タイムアウトを設定:

```sql
-- authenticated: 短め（ユーザー起点クエリ）
ALTER ROLE authenticated SET statement_timeout = '8s';

-- anon: さらに短く（DoS 対策）
ALTER ROLE anon SET statement_timeout = '3s';

-- service_role: 長め（バックエンドジョブも動くため）
ALTER ROLE service_role SET statement_timeout = '60s';
```

**効果**:
- 遅い RLS 式・再帰 JOIN・巨大テーブルスキャンを本番で検知
- 悪意のユーザーによる DoS 攻撃の影響を限定
- **ただしパフォーマンス問題の根本解決ではない** → `performance-verification.md` で原因特定

### セッション内の一時上書き

```sql
-- 重い集計処理の Edge Function 内で一時的に緩める
SET LOCAL statement_timeout = '30s';
-- ... 重いクエリ
```

---

## 10. `search_path` 攻撃の広がり（SECURITY DEFINER 関数）

再掲（`security-definer-functions.md` 参照）: SECURITY DEFINER 関数に `SET search_path = public, pg_temp` を付けないと、悪意ユーザーが一時テーブル / 関数を作って関数本体をハイジャックできる。

**チェック SQL**:

```sql
-- search_path 未設定の SECURITY DEFINER 関数を検出
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true   -- SECURITY DEFINER
  AND NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) cfg
    WHERE cfg LIKE 'search_path=%'
  )
  AND n.nspname NOT IN ('auth', 'storage', 'realtime', 'supabase_functions', 'vault', 'pgsodium');
-- 結果が空であることを本番前に確認
```

---

## 11. LEAKPROOF は Supabase Cloud では使えない

PostgreSQL 公式:
> "Only superuser can mark functions LEAKPROOF"

Supabase Cloud の `postgres` ロールは superuser 権限を持たないため、**カスタム関数に `LEAKPROOF` を付けることはできない**。Self-hosted + superuser 権限がある場合のみ活用可能。

パフォーマンスへの影響:
- 非 LEAKPROOF 関数は RLS 述語より **後** に評価される（pushdown されない）
- LEAKPROOF 関数は RLS 述語より **先** に評価可能（pushdown されて高速）
- 本プロジェクト（Supabase Cloud 前提）では期待しない方針が安全

---

## 12. 監査クエリ集（定期実行推奨）

```sql
-- 1. RLS 無効の public テーブル
SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- 2. ポリシーが 0 件の RLS 有効テーブル（全拒否状態）
SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname);

-- 3. anon / authenticated に TRUNCATE 権限がある
SELECT table_schema, table_name, grantee
FROM information_schema.role_table_grants
WHERE grantee IN ('authenticated', 'anon') AND privilege_type = 'TRUNCATE';

-- 4. search_path 未設定の SECURITY DEFINER 関数
-- （上記 § 10 参照）

-- 5. BYPASSRLS 属性を持つロール
SELECT rolname FROM pg_roles WHERE rolbypassrls AND rolname NOT IN ('postgres', 'supabase_admin');
```

CI / 定期ジョブで実行して、違反があれば Slack 通知する運用を推奨。

---

## チェックリスト

- [ ] `authenticated` / `anon` に **TRUNCATE 権限を付与していない**
- [ ] 公開 API に **連番 ID を露出していない**（UUID v4 等を使用）
- [ ] PII テーブルは **`FORCE ROW LEVEL SECURITY`**
- [ ] pg_cron ジョブは **SECURITY DEFINER 関数経由 + 監査ログ**
- [ ] pgvector 検索ラッパー関数は **SECURITY INVOKER**
- [ ] Realtime DELETE バイパス対策（論理削除 / INSERT+UPDATE のみ購読）
- [ ] `statement_timeout` をロール別に設定
- [ ] SECURITY DEFINER 関数すべてに `SET search_path = public, pg_temp`
- [ ] 監査クエリ（§ 12）を CI で定期実行

## 参考

- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — TRUNCATE / REFERENCES / Superuser バイパス の公式記述
- [PostgreSQL: COPY](https://www.postgresql.org/docs/current/sql-copy.html) — COPY FROM 非対応の公式記述
- [pg_cron GitHub](https://github.com/citusdata/pg_cron) — ジョブ実行ロールの仕様
- [Supabase: RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Supabase: Cron](https://supabase.com/docs/guides/cron)
- [PostgreSQL: statement_timeout](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT)
