---
name: pgtap
description: pgTAP + `supabase test db` を使った RLS ポリシー・DB 関数・制約の SQL ベーステスト。マルチテナント/PII を DB 層で検証する際に使用。supabase-test-helpers（database.dev）による認証コンテキスト切替、`supabase/tests/` の配置規約、TDD ワークフロー、代表的アサーションの実装支援を提供。
---

# pgTAP スキル

このプロジェクトは **pgTAP** と `supabase test db` で RLS ポリシー・DB 関数・制約・トリガーをテストする。

## なぜ pgTAP か

- RLS の正しさは **DB 層で完結して検証** するのが最短・最堅牢
- マルチテナント/PII 保護が最重要要件（→ DB 層の境界で絶対に漏らさない）
- Supabase 公式が CLI (`supabase test db`) + `pg_prove` で直接サポート
- アプリ経由のテスト（`supabase-js` + Vitest）だと「RLS のバグ」「クエリのバグ」が混ざり切り分け困難

**RLS は pgTAP。ビジネスロジックは Vitest/pytest。E2E は Maestro。** 役割を分ける。

## 基本事項

| 項目 | 値 |
|------|-----|
| 実行コマンド | `test-db` script（= `supabase test db --local`） |
| テスト配置先 | `supabase/tests/` フラット構成 |
| ファイル拡張子 | `.sql` または `.pg` |
| 実行順 | アルファベット順（`000-setup-*` で setup を先頭実行） |
| トランザクション | 各ファイルごとに自動ラップ・自動ロールバック |
| 依存 | Docker（`pg_prove` をコンテナで実行）、`supabase start` 起動済み |

## セットアップ

### 1. 共通セットアップファイル

`supabase/tests/000-setup-tests-hooks.sql` で pgtap 拡張と supabase-test-helpers をロードする。
このファイルはアルファベット順で最初に評価される。

```sql
-- supabase/tests/000-setup-tests-hooks.sql
create extension if not exists pgtap with schema extensions;

-- supabase-test-helpers をインストール
-- https://github.com/usebasejump/supabase-test-helpers
-- 最新の SQL を取り込み、tests スキーマに関数群を定義する
```

**supabase-test-helpers の関数**:

| 関数 | 用途 |
|------|------|
| `tests.create_supabase_user(identifier, email?, phone?, metadata?)` | テスト用ユーザー作成 |
| `tests.authenticate_as(identifier)` | 指定ユーザーとして認証（JWT + ROLE 切替） |
| `tests.authenticate_as_service_role()` | service_role で RLS バイパス（フィクスチャ作成用） |
| `tests.clear_authentication()` | 未認証（anon）状態に戻す |
| `tests.get_supabase_uid(identifier)` | identifier から user_id を取得 |

### 2. 実行

```bash
test-db
```

## テストファイルの型

```sql
-- supabase/tests/posts_rls.sql
begin;

select plan(6);

-- ===== フィクスチャ作成（service_role で RLS バイパス） =====
select tests.create_supabase_user('alice', 'alice@example.com');
select tests.create_supabase_user('bob',   'bob@example.com');

select tests.authenticate_as_service_role();

insert into public.posts (id, owner_id, title) values
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('alice'), 'Alice post'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('bob'),   'Bob post');

-- ===== SELECT: 認証ユーザーは自分の行のみ見える =====
select tests.authenticate_as('alice');

select is_empty(
  $$ select 1 from public.posts where owner_id = tests.get_supabase_uid('bob') $$,
  'alice は bob の post を取得できない'
);

select results_eq(
  $$ select title from public.posts $$,
  $$ values ('Alice post'::text) $$,
  'alice は自分の post のみ取得できる'
);

-- ===== INSERT: 自分の owner_id でのみ作成可能 =====
select lives_ok(
  $$ insert into public.posts (owner_id, title) values (tests.get_supabase_uid('alice'), 'new') $$,
  'alice は自分の post を作成できる'
);

select throws_ok(
  $$ insert into public.posts (owner_id, title) values (tests.get_supabase_uid('bob'), 'spoof') $$,
  'new row violates row-level security policy for table "posts"',
  '他人の owner_id で作成はブロックされる'
);

-- ===== DELETE: 他人のデータは削除不可 =====
select throws_ok(
  $$ delete from public.posts where owner_id = tests.get_supabase_uid('bob') $$,
  null,
  '他人の post の削除はブロックされる'
);

-- ===== 未認証（anon）は読めない =====
select tests.clear_authentication();

select is_empty(
  $$ select 1 from public.posts $$,
  '未認証ユーザーは post を取得できない'
);

select * from finish();
rollback;
```

**ポイント**:
- `begin; ... rollback;` はファイル単位で書いておくと読み手に意図が伝わる（`supabase test db` 自体も自動ロールバックするため二重だが害はない）
- `plan(N)` の N はアサーション数と一致させる（違うと FAIL）
- フィクスチャは必ず `authenticate_as_service_role()` で作成してから検証ユーザーに切り替える

## テストマトリクス（必須カバレッジ）

RLS を追加したテーブルは以下すべてを検証する:

| ロール | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `anon`（未認証） | ✅ | ✅ | ✅ | ✅ |
| `authenticated`（自テナント/所有者） | ✅ | ✅ | ✅ | ✅ |
| `authenticated`（他テナント/非所有者） | ✅ | ✅ | ✅ | ✅ |
| `service_role`（フィクスチャ専用、テスト対象外） | - | - | - | - |

**許可ケース**は `lives_ok` / `results_eq` で検証。
**拒否ケース**は `throws_ok`（書き込み系）または `is_empty`（読み取り系、RLS は 0 行返却）で検証。

## 代表的アサーション

### 結果検証

- `is(actual, expected, description)` — スカラー比較
- `results_eq(query, expected_values, description)` — クエリ結果と期待値の一致
- `results_ne(query, expected_values, description)` — 不一致
- `is_empty(query, description)` — 0 行を期待（RLS 読み取り拒否の検証に必須）

### 実行可否

- `lives_ok(sql, description)` — SQL が例外なく完了
- `throws_ok(sql, expected_error_message?, description)` — SQL が指定エラーで失敗

### スキーマ・ポリシー

- `policies_are(schema, table, expected_policy_names_array)` — ポリシー名の過不足確認
- `policy_cmd_is(schema, table, policy_name, expected_cmd)` — `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`ALL` の確認
- `policy_roles_are(schema, table, policy_name, expected_roles_array)` — 適用ロール確認

### テーブル・カラム

- `has_table(schema, table)`, `has_column(schema, table, col)`, `col_is_pk(...)`, `col_not_null(...)`

## TDD ワークフロー

1. **Red**: RLS ポリシーをまだ書かない状態で、拒否シナリオのテストを書く。
   `tests.authenticate_as('bob')` で他人の行を SELECT できてしまい `is_empty` が FAIL する。
2. **Green**: 最小のポリシーを `drizzle/schema/` に追加して `devenv tasks run app:migrate-dev` を依頼。
   → 再度 `test-db` で PASS。
3. **Refactor**: ポリシー式を読みやすく整理。テストは触らない。

**重要**: テストを修正して PASS させるのは禁止。必ず実装（RLS ポリシー）側を修正する。

## マルチテナントの例

JWT の `app_metadata.tenant_id` を RLS で参照する場合:

```sql
-- setup
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

-- テスト
select tests.authenticate_as('alice');
select is_empty(
  $$ select 1 from public.orders where tenant_id = 'contoso' $$,
  'acme の alice は contoso の注文を取得できない'
);
```

※ `tests.create_supabase_user` の metadata 引数は helpers のバージョンにより `raw_user_meta_data` / `raw_app_meta_data` に対応するかが異なるため、使用している helpers のソースを確認する。

## 禁止パターン

- ❌ `SET LOCAL request.jwt.claims = '...'` を手動で組み立てる
  → `tests.authenticate_as(...)` を使う（ROLE 切替も一緒に面倒見てくれる）
- ❌ RLS を `alter table disable row level security` で無効化してテストする
  → service_role で `authenticate_as_service_role()` を使う
- ❌ `plan(N)` の N をアサーション数と合わせずに済ませる
  → 合わないと pgTAP は FAIL 扱い
- ❌ フィクスチャを `authenticated` ロールで作成して RLS で詰まる
  → `authenticate_as_service_role()` で seed

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `function tests.authenticate_as(text) does not exist` | supabase-test-helpers 未ロード | `000-setup-tests-hooks.sql` を確認 |
| `extension "pgtap" is not available` | pgtap extension 未有効化 | `create extension if not exists pgtap with schema extensions;` |
| Docker エラー | Docker 未起動 or `supabase start` 未実行 | `supabase start` → 再実行 |
| 期待と違う件数 | `plan(N)` の N 不一致 or フィクスチャが他のテストに混線 | N を数え直す・各ファイルは独立（自動 rollback）である前提 |
| `throws_ok` が PASS しない | エラーメッセージ文字列が Postgres バージョンで違う | 2番目の引数を `null` にしてメッセージ非依存にする |

## 参考

- [Supabase: pgTAP Extension](https://supabase.com/docs/guides/database/extensions/pgtap)
- [Supabase: Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase: pgTAP Extended](https://supabase.com/docs/guides/local-development/testing/pgtap-extended)
- [supabase test db CLI](https://supabase.com/docs/reference/cli/supabase-test-db)
- [usebasejump/supabase-test-helpers](https://github.com/usebasejump/supabase-test-helpers)
- [pgTAP 本家ドキュメント](https://pgtap.org/documentation.html)
