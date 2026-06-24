---
title: RLS テスト — 4×4 マトリクステンプレート + CI 回帰防止
category: testing
priority: CRITICAL
---

# Testing RLS

RLS の挙動は **実際に動かすまで確信を持てない**。全テーブルに対し **認証済み/未認証 × 自分/他人 × SELECT/INSERT/UPDATE/DELETE** のマトリクステストを pgTAP で網羅する。

前提: `.claude/skills/pgtap/SKILL.md` のセットアップ（`000-setup-tests-hooks.sql` で supabase-test-helpers ロード済み）。

---

## 1. 4 × 4 マトリクス（必須カバレッジ）

RLS を有効化した全テーブルに対し、最低以下の 16 ケースを pgTAP で検証:

| ロール／オペレーション | SELECT | INSERT | UPDATE | DELETE |
|---------------------|--------|--------|--------|--------|
| **anon**（未認証） | 許可 or 拒否 | 許可 or 拒否 | 許可 or 拒否 | 許可 or 拒否 |
| **authenticated（自分 / 自組織）** | 許可 | 許可 | 許可 | 許可 |
| **authenticated（他人 / 他組織）** | 拒否 | 拒否 | 拒否 | 拒否 |
| **service_role** | ロールバイパス（フィクスチャ用、検証対象外） | | | |

**重要**: 「**他人のデータで許可されるべきでない操作が確実に拒否される**」ことは pgTAP で絶対に検証する。ここが甘いと情報漏洩する。

---

## 2. テンプレート（コピペ可能）

新しいテーブルを作ったら、以下のテンプレートをコピーして名前を書き換える。

```sql
-- supabase/tests/posts_rls.sql
begin;

select plan(16);  -- 4 × 4 = 16 アサーション

-- ==========================================
-- フィクスチャ（service_role で RLS バイパス）
-- ==========================================
select tests.create_supabase_user('alice', 'alice@example.com');
select tests.create_supabase_user('bob',   'bob@example.com');

select tests.authenticate_as_service_role();

insert into public.posts (id, user_id, title) values
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('alice'), 'alice post'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('bob'),   'bob post');

-- ==========================================
-- anon（未認証）: 全拒否を期待
-- ==========================================
select tests.clear_authentication();

select is_empty(
  $$ select 1 from public.posts $$,
  '[anon] SELECT: all rows are hidden'
);

select throws_ok(
  $$ insert into public.posts (user_id, title) values (gen_random_uuid(), 'x') $$,
  null,
  '[anon] INSERT: denied'
);

select throws_ok(
  $$ update public.posts set title = 'hacked' where id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  '[anon] UPDATE: denied (silently — 0 rows affected)',
  true   -- RLS での UPDATE は throws でなく 0 rows のこともある → is_empty で再確認
) or select is(
  (select count(*) from public.posts where title = 'hacked'),
  0::bigint,
  '[anon] UPDATE: no rows modified'
);

select throws_ok(
  $$ delete from public.posts where id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  '[anon] DELETE: denied'
) or select is(
  (select count(*) from public.posts),
  2::bigint,
  '[anon] DELETE: no rows deleted'
);

-- ==========================================
-- authenticated (alice) — 自分のデータ: 許可を期待
-- ==========================================
select tests.authenticate_as('alice');

select results_eq(
  $$ select title from public.posts where user_id = tests.get_supabase_uid('alice') $$,
  $$ values ('alice post'::text) $$,
  '[alice] SELECT own: returns own row'
);

select lives_ok(
  $$ insert into public.posts (user_id, title) values (tests.get_supabase_uid('alice'), 'new') $$,
  '[alice] INSERT own: allowed'
);

select lives_ok(
  $$ update public.posts set title = 'updated' where id = '11111111-1111-1111-1111-111111111111' $$,
  '[alice] UPDATE own: allowed'
);

select lives_ok(
  $$ delete from public.posts where id = '11111111-1111-1111-1111-111111111111' $$,
  '[alice] DELETE own: allowed'
);

-- フィクスチャ再構築（alice が削除したので bob のテスト前に service_role で復元）
select tests.authenticate_as_service_role();
insert into public.posts (id, user_id, title) values
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('alice'), 'alice post')
on conflict do nothing;

-- ==========================================
-- authenticated (alice) — bob のデータ: 全拒否を期待
-- ==========================================
select tests.authenticate_as('alice');

select is_empty(
  $$ select 1 from public.posts where user_id = tests.get_supabase_uid('bob') $$,
  '[alice→bob] SELECT: bob rows are hidden'
);

select throws_ok(
  $$ insert into public.posts (user_id, title) values (tests.get_supabase_uid('bob'), 'spoof') $$,
  'new row violates row-level security policy for table "posts"',
  '[alice→bob] INSERT with bob user_id: blocked (WITH CHECK)'
);

-- UPDATE は WITH CHECK 欠如で通ることがある → 両面テスト
select is(
  (
    with updated as (
      update public.posts set title = 'hacked'
      where id = '22222222-2222-2222-2222-222222222222'
      returning 1
    )
    select count(*) from updated
  ),
  0::bigint,
  '[alice→bob] UPDATE: 0 rows affected'
);

select is(
  (
    with deleted as (
      delete from public.posts where id = '22222222-2222-2222-2222-222222222222' returning 1
    )
    select count(*) from deleted
  ),
  0::bigint,
  '[alice→bob] DELETE: 0 rows affected'
);

-- ==========================================
-- 整合性最終確認: bob の行が改変・削除されていないこと
-- ==========================================
select tests.authenticate_as_service_role();

select results_eq(
  $$ select title from public.posts where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('bob post'::text) $$,
  '[final] bob row intact after all attack attempts'
);

select * from finish();
rollback;
```

**テンプレートの使い方**:
1. `posts` → 対象テーブル名、`user_id` → 所有者カラム名に置き換え
2. フィクスチャ（INSERT ... VALUES）を対象テーブル構造に合わせる
3. アサーション数を調整して `plan(N)` を更新

---

## 3. マルチテナントパターン用テンプレート

`tenant_id` + JWT `app_metadata.tenant_id` の場合:

```sql
-- ==========================================
-- マルチテナント fixture
-- ==========================================
select tests.create_supabase_user(
  'alice',
  'alice@acme.com',
  phone => null,
  metadata => jsonb_build_object('tenant_id', 'acme')
);
select tests.create_supabase_user(
  'carol',
  'carol@contoso.com',
  phone => null,
  metadata => jsonb_build_object('tenant_id', 'contoso')
);
-- ※ supabase-test-helpers の metadata 引数は app_metadata に入ることを
--    使用する helpers のバージョンで確認（SKILL.md 参照）

select tests.authenticate_as_service_role();
insert into public.orders (id, tenant_id, ...) values
  (..., 'acme'::uuid, ...),
  (..., 'contoso'::uuid, ...);

-- ==========================================
-- alice (acme) から contoso のデータ: 全拒否
-- ==========================================
select tests.authenticate_as('alice');

select is_empty(
  $$ select 1 from public.orders where tenant_id = 'contoso'::uuid $$,
  '[acme→contoso] SELECT: cross-tenant blocked'
);

-- INSERT: 自分の tenant_id でなら通る、他 tenant では拒否
select lives_ok(
  $$ insert into public.orders (tenant_id, ...) values ('acme'::uuid, ...) $$,
  '[acme] INSERT own tenant: allowed'
);

select throws_ok(
  $$ insert into public.orders (tenant_id, ...) values ('contoso'::uuid, ...) $$,
  'new row violates row-level security',
  '[acme→contoso] INSERT cross-tenant: blocked by WITH CHECK'
);
```

---

## 4. SECURITY DEFINER 関数のテスト

関数自体の単体テスト + ポリシー経由の統合テスト:

```sql
-- 関数単体: 認可ロジックが正しいか
select tests.authenticate_as('alice');
select is(
  public.is_org_member('alice_org_id'::uuid),
  true,
  'is_org_member returns true for own org'
);
select is(
  public.is_org_member('bob_org_id'::uuid),
  false,
  'is_org_member returns false for other org'
);

-- ポリシー経由: 関数が実際にポリシーで正しく呼ばれているか
select results_eq(
  $$ select name from public.orgs where name = 'alice_org' $$,
  $$ values ('alice_org'::text) $$,
  'RLS via is_org_member: alice sees own org'
);
```

---

## 5. EXPLAIN による性能回帰テスト（応用）

RLS 変更でパフォーマンスが劣化していないか、計画の形状を pgTAP で固定化:

```sql
-- 実行計画に InitPlan が含まれること（= (SELECT auth.uid()) ラップが効いている）
select like(
  (
    select string_agg(info, E'\n')
    from (
      select * from pg_catalog.pg_stat_activity limit 0
    ) t,
    lateral (
      select "QUERY PLAN" as info from dblink(
        'hostaddr=127.0.0.1 port=5432 dbname=postgres',
        'EXPLAIN SELECT * FROM public.posts WHERE user_id = auth.uid()'
      ) as x("QUERY PLAN" text)
    ) t2
  ),
  '%InitPlan%',
  'EXPLAIN contains InitPlan (auth.uid() is wrapped)'
);
```

**実用的アプローチ**: 厳密な EXPLAIN 検証は複雑なので、**本番では `pg_stat_statements` で平均実行時間を定期監視** する方が現実的。pgTAP では「最低限 InitPlan があること」程度の smoke test に留めるのが運用しやすい。

---

## 6. CI 統合

### Makefile

本プロジェクトの `test-db` を CI で実行:

```yaml
# .github/workflows/ci.yml（例）
- name: Start Supabase
  run: supabase start

- name: Apply migrations
  run: supabase db push

- name: Run RLS tests
  run: test-db
```

### テストが失敗したら絶対にマージしない

- RLS テストの失敗は **即 merge block**（branch protection で強制）
- 「fix later」は禁止 — セキュリティ境界の回帰は本番障害に直結

---

## 7. カバレッジ監査

RLS 有効なのにテストが書かれていないテーブルを検出:

```sql
-- RLS 有効テーブル一覧
WITH rls_tables AS (
  SELECT n.nspname || '.' || c.relname AS fq_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
)
SELECT * FROM rls_tables;
-- この結果と supabase/tests/*.sql のファイル名を突合し、
-- テストがない RLS テーブルを発見する（CI スクリプトで自動化可能）
```

CI スクリプト例:

```bash
#!/usr/bin/env bash
# scripts/check-rls-test-coverage.sh

# RLS 有効テーブルを取得
tables=$(psql ... -tAc "
  SELECT relname FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relrowsecurity;
")

missing=0
for table in $tables; do
  if ! ls supabase/tests/*_rls.sql | grep -q "${table}_rls"; then
    echo "❌ Missing RLS test for: $table"
    missing=$((missing + 1))
  fi
done

if [ $missing -gt 0 ]; then
  echo "Total missing: $missing"
  exit 1
fi
```

---

## 8. pgTAP の便利アサーション（RLS 文脈）

| アサーション | 用途 |
|-------------|------|
| `is_empty(query, desc)` | RLS 拒否を検証（0 行が返る） |
| `throws_ok(sql, err_pattern, desc)` | INSERT/UPDATE の `WITH CHECK` 違反を検証 |
| `lives_ok(sql, desc)` | 許可ケースが例外なく通ることを検証 |
| `results_eq(query, expected, desc)` | SELECT 結果の一致 |
| `policies_are(schema, table, expected_names[], desc)` | ポリシー名の過不足 |
| `policy_cmd_is(schema, table, policy_name, expected_cmd)` | SELECT/INSERT/UPDATE/DELETE/ALL の確認 |
| `policy_roles_are(schema, table, policy_name, expected_roles[])` | `TO` ロールの確認 |

---

## 9. よくあるテストの罠

### (a) UPDATE の RLS は throws せず 0 rows になる

`USING` で対象外の行を更新しようとすると、**エラーにならず単に 0 rows affected** になる。`throws_ok` だけでは拒否を検証できない → **更新されていないことを事後 SELECT で確認**。

### (b) `supabase-test-helpers` の metadata 引数

helpers のバージョンにより `metadata` が `raw_user_meta_data` に入るか `raw_app_meta_data` に入るかが異なる。使用している helpers のソースを確認する（`.claude/skills/pgtap/SKILL.md` 参照）。

### (c) 認証コンテキストを戻し忘れる

テストの最後に `clear_authentication()` または次のユーザーに `authenticate_as()` し忘れると、次のテストファイルに影響する可能性。ファイル単位で `begin; ... rollback;` で包まれるので基本は漏れないが、意図的に `clear_authentication()` を呼ぶ。

### (d) `plan(N)` の不一致

`plan(16)` と書いて 15 個しかアサーションがないと pgTAP は FAIL 扱い。アサーション追加時は必ず N を更新。

---

## チェックリスト

- [ ] 全 RLS 有効テーブルに対し `supabase/tests/<table>_rls.sql` が存在
- [ ] 各テストで 4 ロール × 4 オペレーション = 16 ケースを最低カバー
- [ ] 他人データへの UPDATE / DELETE は **「0 rows affected」** を事後 SELECT で検証
- [ ] マルチテナント: クロステナントアクセスが確実に拒否される pgTAP テストがある
- [ ] SECURITY DEFINER 関数は関数単体 + ポリシー経由の両方でテスト
- [ ] `test-db` が CI で PASS してから merge
- [ ] RLS テストのないテーブルを検出するカバレッジスクリプトが CI にある
- [ ] pgTAP テストの FAIL は即 merge block（branch protection）

## 参考

- [pgTAP Documentation](https://pgtap.org/documentation.html) — 全アサーション一覧
- [Supabase: Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase: pgTAP Extended](https://supabase.com/docs/guides/local-development/testing/pgtap-extended)
- [usebasejump/supabase-test-helpers](https://github.com/usebasejump/supabase-test-helpers)
- 本プロジェクトのスキル: `.claude/skills/pgtap/SKILL.md`
