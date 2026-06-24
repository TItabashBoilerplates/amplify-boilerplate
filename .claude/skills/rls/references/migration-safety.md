---
title: RLS マイグレーション安全性（本番変更の手順）
category: operations
priority: HIGH
---

# Migration Safety

RLS の変更は **データが見えなくなる / 見えてはいけないデータが見える** の二重リスクがある。本番で安全に変更する手順と PostgreSQL の制約を整理する。

## 1. ALTER POLICY は制限が多い（公式仕様）

PostgreSQL 公式:
> "ALTER POLICY only allows the set of roles to which the policy applies and the USING and WITH CHECK expressions to be modified."
> "To change other properties of a policy, such as the command to which it applies or whether it is permissive or restrictive, the policy must be dropped and recreated."

### ALTER POLICY で変更できるもの

| 項目 | ALTER POLICY 可能 |
|------|------------------|
| `TO` ロール（対象ロール） | ✅ |
| `USING` 式 | ✅ |
| `WITH CHECK` 式 | ✅ |
| ポリシー名変更 | ✅（RENAME） |
| `FOR` コマンド（SELECT/INSERT 等） | ❌ DROP + CREATE 必須 |
| `AS PERMISSIVE` / `AS RESTRICTIVE` 切替 | ❌ DROP + CREATE 必須 |

**実務影響**: `FOR ALL` で作ったポリシーを `FOR SELECT` に分けたい → 既存ポリシーを DROP してから新しいポリシーを CREATE する必要がある。**一瞬でも DROP 状態になる** → 本番では必ずトランザクション内で実施。

---

## 2. 既存テーブルに RLS を後から追加する手順

既にデータが入っているテーブルに RLS を適用するのは最も事故りやすい操作。**手順を間違えると全ユーザーがデータ閲覧不能になる**。

### 正しい順序

```sql
BEGIN;

-- Step 1: 必要なポリシーを先に CREATE（まだ RLS 無効なので影響なし）
CREATE POLICY "posts_select_own" ON public.posts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ... 4 オペレーション分すべて作成

-- Step 2: RLS を有効化（この瞬間から上記ポリシーが効く）
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Step 3: 検証クエリで所有者が自データを見られることを確認
-- （本来は pgTAP で事前検証するのが理想）

COMMIT;
```

### よくある事故

```sql
-- ❌ BAD: 先に RLS を有効化してしまう
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
-- → ポリシーが一つもないので全操作が拒否される
-- → この時点でアプリが落ちる

CREATE POLICY ...;  -- 後から貼っても、その間の全リクエストが失敗
```

### RLS 適用前のデータ整合性チェック

RLS ポリシーが期待通り動くには、既存データが `user_id` 等を正しく持っていることが前提。RLS 有効化前に:

```sql
-- 所有者不明の行を検出
SELECT COUNT(*) FROM public.posts WHERE user_id IS NULL;
-- → 0 であることを確認

-- 存在しないユーザーを参照している行
SELECT COUNT(*) FROM public.posts p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL;
-- → 0 であることを確認
```

---

## 3. ポリシーを安全に差し替える（DROP + CREATE）

PERMISSIVE ↔ RESTRICTIVE 切替、コマンド変更等で必要:

### トランザクション内で差し替え

```sql
BEGIN;

-- 既存ポリシーを DROP
DROP POLICY "old_policy" ON public.posts;

-- 新ポリシーを CREATE（DROP と同一トランザクション内）
CREATE POLICY "new_policy" ON public.posts FOR SELECT TO authenticated
  AS RESTRICTIVE
  USING (...);

COMMIT;
```

**重要**: 単一トランザクション内なら、DROP と CREATE の間に「ポリシーが消えている瞬間」は他セッションから見えない（PostgreSQL の MVCC）。

### 段階的な移行（新旧並行期間が必要な場合）

「新ポリシーを追加 → 動作確認 → 旧ポリシーを削除」したい場合:

```sql
-- Step 1: 新ポリシーを別名で追加（PERMISSIVE なので OR で共存）
CREATE POLICY "posts_select_v2" ON public.posts FOR SELECT TO authenticated
  USING (new_logic);
-- この時点で旧ポリシー OR 新ポリシーのどちらかが true なら見える

-- Step 2: 新ポリシーで動いていることを pg_stat_statements / ログで確認
-- Step 3: 旧ポリシーを DROP
DROP POLICY "posts_select_v1" ON public.posts;
```

**注意**: RESTRICTIVE の場合は並行期間中に **さらに絞られる** ので要件を間違えない。

---

## 4. Lock 影響の範囲

PostgreSQL 公式は `ALTER POLICY` の正確なロック種別を個別には明記していないが、ポリシー定義の変更は **`pg_policies` カタログ更新 + テーブル定義のキャッシュ無効化** を伴うため、`ALTER TABLE` 系と同等の `ACCESS EXCLUSIVE` レベルで短時間テーブルロックを取る（DDL の一般的な挙動）。

**実務的影響**:
- 長時間クエリがロックを握っていると DDL がブロックされる
- DDL を先に流すと、その後の一般クエリが数 ms〜数百 ms 待つ可能性
- **高負荷時間帯を避ける**、または `lock_timeout` で暴発を防ぐ

### 推奨: DDL の前に lock_timeout を設定

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';   -- 2秒以上ロック待ちならエラーで抜ける
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON public.posts ...;

COMMIT;
```

ロック取得に失敗したら `ROLLBACK` で安全に退避。

---

## 5. Drizzle + Supabase でのマイグレーションワークフロー

本プロジェクトの既定フロー（`.claude/rules/database.md` + `drizzle/README.md`）:

```
1. drizzle/schema/*.ts を編集
   ├─ pgTable 定義（enableRLS 含む）
   └─ pgPolicy 定義

2. SECURITY DEFINER 関数が必要な場合:
   drizzle/config/post-migration/*.sql に SQL を追記（migrate.ts が drizzle-kit migrate の後に実行）

3. devenv tasks run app:migrate-dev（ローカルは AI 自動実行可。本番デプロイ db:migrate-deploy は要承認）
   ├─ migrate:pre: drizzle/config/pre-migration/*.sql を実行（extensions 等）
   ├─ drizzle-kit generate: drizzle/migrations/<ts>_<name>/migration.sql を生成
   ├─ drizzle-kit migrate: ローカル DB に適用
   ├─ migrate:post: drizzle/config/post-migration/*.sql を実行（functions/triggers/realtime）
   └─ 型再生成

4. マイグレーション内容を確認
   ├─ drizzle/migrations/<ts>_<name>/migration.sql
   └─ DROP/CREATE や ALTER POLICY のタイミングを人間がレビュー

5. pgTAP テスト実行: test-db
   └─ RLS の挙動が回帰していないか全ケース検証

6. 問題なければコミット
```

### drizzle-kit が生成する DDL の落とし穴

- **ポリシー式の微小な変更でも DROP + CREATE される** ことがある（drizzle-kit の差分検出アルゴリズム依存）
- 生成された SQL を **必ず目視確認** して、期待通りの順序（CREATE before DROP か逆か）になっているかチェック
- 不安なら生成 SQL を手動編集して `BEGIN; ... COMMIT;` に包む

---

## 6. 本番適用前チェックリスト

- [ ] ローカル環境 (`supabase start`) でマイグレーションが通ることを確認
- [ ] **pgTAP テストが全 PASS**（`test-db`）
- [ ] RLS を新規有効化するテーブルで、既存データの `user_id` / `tenant_id` 等が正しいか事前検証
- [ ] 生成された `drizzle/migrations/<ts>_<name>/migration.sql` を目視レビュー
- [ ] DROP + CREATE が混在する場合、トランザクションで包まれているか確認
- [ ] `lock_timeout` / `statement_timeout` を migration 実行時に設定
- [ ] ロールバック手順を書面化（「何が起きたら何を流すか」）
- [ ] 本番適用は低負荷時間帯
- [ ] 適用直後に `pg_stat_statements` で遅いクエリが出ていないか監視

---

## 7. ロールバック戦略

### 「元のポリシーに戻す」SQL を準備

マイグレーション適用前に、**逆操作の SQL** を書面化:

```sql
-- Rollback for: 2026-04-18_posts_restrict_to_aal2.sql

BEGIN;

-- 新 RESTRICTIVE ポリシーを削除
DROP POLICY "posts_update_requires_mfa" ON public.posts;

-- 旧 PERMISSIVE ポリシーを復元
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;
```

Supabase Cloud でも、問題発生時にこの SQL を **Supabase Studio の SQL Editor** で直接実行できるよう準備しておく。

### drizzle-kit による自動ロールバックは期待しない

drizzle-kit は down migration を生成しない。**手動で逆操作 SQL を書く**。

---

## 8. 変更のリスクマトリクス

| 変更内容 | リスク | 事前検証 | 適用時間帯 |
|---------|--------|---------|-----------|
| 新規テーブルに RLS + ポリシー追加 | 低 | pgTAP | いつでも |
| 既存テーブルに RLS を**初めて**有効化 | **高**（ポリシー漏れでアクセス不能） | pgTAP + 既存データ整合性チェック | 低負荷時間帯 |
| USING 式の厳格化（例: 管理者のみ → admin かつ MFA） | 中（見えてたものが見えなくなる） | pgTAP で「誰が何を見えるか」全パターン | 低負荷時間帯 |
| USING 式の緩和（範囲拡大） | 低〜中 | pgTAP | いつでも |
| PERMISSIVE → RESTRICTIVE 切替 | **高**（全拒否の可能性） | pgTAP 徹底 | メンテナンス窓 |
| SECURITY DEFINER 関数の書き換え | 中（式キャッシュ・プランキャッシュの影響） | pgTAP + EXPLAIN | 低負荷時間帯 |
| インデックス追加 | 低（CONCURRENTLY 使用時） | EXPLAIN で使われるか確認 | いつでも |
| インデックス削除 | 中（遅くなる） | pg_stat_user_indexes.idx_scan = 0 確認 | 低負荷時間帯 |

---

## 9. `CREATE INDEX CONCURRENTLY` を使う

大きいテーブルへのインデックス追加はロックで長時間ブロックする。`CONCURRENTLY` でオンライン追加:

```sql
-- ✅ 大きいテーブルでのインデックス追加
CREATE INDEX CONCURRENTLY posts_user_id_idx ON public.posts (user_id);
```

**注意**:
- `CONCURRENTLY` は **トランザクション内で実行不可**
- drizzle-kit は通常 `CONCURRENTLY` を生成しない → マイグレーション SQL を手動編集
- 失敗したインデックスは `INVALID` 状態で残る → `DROP INDEX` して再実行

---

## チェックリスト

- [ ] 既存テーブルへの RLS 追加は **ポリシー CREATE → RLS ENABLE** の順
- [ ] DROP POLICY + CREATE POLICY は **同一トランザクション**
- [ ] drizzle 生成 SQL を **目視レビュー**
- [ ] pgTAP テストが PASS してから適用
- [ ] `lock_timeout` / `statement_timeout` を設定してから DDL
- [ ] ロールバック SQL を事前準備
- [ ] 大テーブルへのインデックス追加は `CREATE INDEX CONCURRENTLY`
- [ ] 高リスク変更（PERMISSIVE ↔ RESTRICTIVE 等）は低負荷時間帯 / メンテナンス窓

## 禁止パターン

```sql
-- ❌ ポリシーなしで RLS 有効化（全拒否）
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
-- （ポリシーを貼る前）

-- ❌ DROP/CREATE を別トランザクションで実施
DROP POLICY "old" ON posts;
-- （この瞬間に別セッションから全行見える or 全拒否）
CREATE POLICY "new" ON posts ...;

-- ❌ lock_timeout なしで長時間 DDL
ALTER TABLE large_table ...;  -- 他セッションを何分も止める

-- ❌ CONCURRENTLY なしでの大テーブル INDEX 作成
CREATE INDEX posts_big_idx ON posts (foo);  -- テーブルロック取って止まる
```

## 参考

- [PostgreSQL: ALTER POLICY](https://www.postgresql.org/docs/current/sql-alterpolicy.html) — 変更可能項目の正式仕様
- [PostgreSQL: CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [PostgreSQL: lock_timeout / statement_timeout](https://www.postgresql.org/docs/current/runtime-config-client.html)
- 本プロジェクトの `.claude/rules/database.md` — migration ワークフロー
