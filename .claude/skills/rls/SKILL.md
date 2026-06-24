---
name: rls
description: Supabase RLS（Row-Level Security）を高セキュリティかつハイパフォーマンスに実装するためのスキル。ポリシー設計、SECURITY DEFINER 関数、PERMISSIVE/RESTRICTIVE、`(SELECT auth.uid())` ラッパー、TO ロール、インデックス、Volatility、列レベル保護、Storage・Realtime の RLS、EXPLAIN 検証など、公式ベンチマークに基づく全ベストプラクティスをトピック別リファレンスに分割して提供。
---

# RLS（Row-Level Security）スキル

**前提: RLS は高セキュリティかつハイパフォーマンスを両立させる**。どちらも妥協しない。

RLS は「書けば動く」ではなく **「正しく、速く、漏らさず」** 書く。このスキルは公式ドキュメント + PostgreSQL 公式仕様 + 実測ベンチマークに基づくベストプラクティスを、トピック別の `references/` に分割して提供する。

## いつ使うか

- 新規テーブルに RLS ポリシーを設計・追加する
- 既存 RLS のパフォーマンスを最適化する
- マルチテナント / 組織メンバーシップ / 所有者判定の認可を設計する
- Storage / Realtime に関わる RLS を書く
- RLS レビュー・セキュリティ監査を行う
- `EXPLAIN ANALYZE` で遅いクエリを分析する

関連スキル:
- `drizzle/` — `pgPolicy` / `enableRLS()` の書き方
- `pgtap/` — RLS の挙動を DB 層でテスト
- `supabase-postgres-best-practices/` — Postgres 全般の最適化

---

## Top 原則（これだけは必ず守る）

| # | 原則 | 公式ベンチマーク |
|---|------|-----------------|
| 1 | `auth.uid()` / `auth.jwt()` は **`(SELECT ...)` でラップ** | 179ms → 9ms（最大 178,000ms → 12ms） |
| 2 | すべてのポリシーで **`TO` ロール明示** | 170ms → <0.1ms |
| 3 | RLS で参照するカラムに **btree インデックス** | 171ms → <0.1ms |
| 4 | 多段 JOIN の RLS は **SECURITY DEFINER + STABLE 関数** に切り出し | 11,000ms → 7ms |
| 5 | クライアントでも **明示フィルタ** を追加（RLS 任せにしない） | 171ms → 9ms |
| 6 | `UPDATE` ポリシーは **`USING` + `WITH CHECK` 両方必須** | — |
| 7 | 認可判定は **`raw_app_meta_data` のみ**（user_metadata は改ざん可） | セキュリティ要件 |

---

## リファレンス構成

セキュリティ寄り・パフォーマンス寄りで分類。すべて `references/` 配下。

### 🔒 Security（セキュリティ）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [security-baseline.md](references/security-baseline.md) | 全テーブルで RLS 有効化、`FORCE RLS`、`service_role` キーの扱い、`raw_app_meta_data` vs `raw_user_meta_data` | **CRITICAL** |
| [policy-correctness.md](references/policy-correctness.md) | `USING` vs `WITH CHECK` マトリクス、PERMISSIVE/RESTRICTIVE の結合仕様、コマンド分割 | **CRITICAL** |
| [auth-patterns.md](references/auth-patterns.md) | `auth.uid()` / `auth.jwt()` のラップと使い分け、`auth.users` を JOIN しない、anon 対応 | HIGH |
| [security-definer-functions.md](references/security-definer-functions.md) | SECURITY DEFINER の安全な書き方、`search_path` injection 防止、短絡評価パターン | **CRITICAL** |
| [column-level-security.md](references/column-level-security.md) | PII 列の保護、VIEW + security_invoker、別テーブル分割、AAL2 強制 | HIGH |
| [extensions-and-edge-cases.md](references/extensions-and-edge-cases.md) | TRUNCATE / REFERENCES / COPY FROM のバイパス、pg_cron / pgvector / パーティショニング、`statement_timeout` | **CRITICAL** |

### ⚡ Performance（パフォーマンス）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [indexes-for-rls.md](references/indexes-for-rls.md) | btree / 複合 / 部分 / 式 / covering インデックス、FK 列、pg_stat_user_indexes 監視 | **CRITICAL** |
| [function-volatility.md](references/function-volatility.md) | `STABLE` / `IMMUTABLE` / `VOLATILE` の使い分け、`LEAKPROOF` / `PARALLEL SAFE` | HIGH |
| [performance-verification.md](references/performance-verification.md) | `EXPLAIN (ANALYZE, BUFFERS)` の読み方、`pg_stat_statements`、`index_advisor` | HIGH |

### 📚 Patterns & Cookbook（実装パターン）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [policy-cookbook.md](references/policy-cookbook.md) | 11 パターンのコピペ可能テンプレート（Owner / Public / Org Member / ACL / Hierarchical / MFA / pgvector RAG 等） | HIGH |
| [multi-tenancy-patterns.md](references/multi-tenancy-patterns.md) | B2B SaaS テナント分離（tenant_id 列・マテリアライズド所属・schema-per-tenant）、JWT race condition、admin アクセス | HIGH |

### 🛠️ Operations（運用）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [migration-safety.md](references/migration-safety.md) | 既存テーブルへの RLS 追加、`ALTER POLICY` の制限、DROP+CREATE トランザクション、`CREATE INDEX CONCURRENTLY`、ロールバック | HIGH |
| [testing-rls.md](references/testing-rls.md) | **4 × 4 マトリクステンプレート**（コピペ可能）、CI 統合、カバレッジ監査、pgTAP の落とし穴 | **CRITICAL** |

### 🌐 Service-specific（サービス別）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [storage-rls.md](references/storage-rls.md) | `storage.objects` ポリシー、`foldername()`、Private bucket + Signed URL、パス設計 | HIGH |
| [realtime-rls.md](references/realtime-rls.md) | publication、`REPLICA IDENTITY`、DELETE イベントの RLS バイパス対策、大規模購読 | HIGH |

---

## マスターチェックリスト

RLS をレビューする際は以下を順に確認する。該当リファレンスを読んで判断:

### セキュリティ
- [ ] `public` スキーマの **全テーブルで RLS 有効** → `security-baseline.md`
- [ ] PII テーブルは `FORCE ROW LEVEL SECURITY` → `security-baseline.md`
- [ ] `service_role` キーが **フロントに漏れていない**（`NEXT_PUBLIC_` にない）→ `security-baseline.md`
- [ ] 認可判定に **`raw_user_meta_data` を使っていない** → `auth-patterns.md`
- [ ] RLS 内で `auth.users` を JOIN していない → `auth-patterns.md`
- [ ] UPDATE ポリシーに **`USING` + `WITH CHECK`** が両方ある → `policy-correctness.md`
- [ ] INSERT は `WITH CHECK` のみ、SELECT/DELETE は `USING` のみ → `policy-correctness.md`
- [ ] SECURITY DEFINER 関数に **`SET search_path = public, pg_temp`** が指定されている → `security-definer-functions.md`
- [ ] SECURITY DEFINER 関数内に **認可チェック** がある → `security-definer-functions.md`
- [ ] `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO <role>` → `security-definer-functions.md`
- [ ] PII 列は別テーブルに分離検討 → `column-level-security.md`
- [ ] `authenticated` / `anon` に **TRUNCATE 権限を付与していない**（公式: TRUNCATE は RLS 非適用） → `extensions-and-edge-cases.md`
- [ ] 公開 API に **連番 ID を露出していない**（REFERENCES が RLS をバイパスするため） → `extensions-and-edge-cases.md`
- [ ] pg_cron ジョブは **SECURITY DEFINER 関数経由 + 監査ログ** → `extensions-and-edge-cases.md`
- [ ] pgvector 検索ラッパー関数は **SECURITY INVOKER** → `extensions-and-edge-cases.md`
- [ ] `statement_timeout` をロール別に設定（authenticated 8s 等） → `extensions-and-edge-cases.md`

### パフォーマンス
- [ ] すべての `auth.uid()` / `auth.jwt()` が **`(SELECT ...)` でラップ** → `auth-patterns.md`
- [ ] すべてのポリシーに **`TO` ロール明示** → `policy-correctness.md`
- [ ] RLS で参照するカラムすべてに **インデックス** → `indexes-for-rls.md`
- [ ] FK 列にインデックス（自動では貼られない） → `indexes-for-rls.md`
- [ ] SECURITY DEFINER 関数に **`STABLE`** マーカー → `function-volatility.md`
- [ ] 3段以上の JOIN RLS は SECURITY DEFINER 関数化 → `security-definer-functions.md`
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` で `InitPlan` と `Index Scan` が見える → `performance-verification.md`
- [ ] `pg_stat_statements` で遅いクエリを継続監視 → `performance-verification.md`
- [ ] クライアントクエリに明示フィルタ（RLS 任せにしない） → `auth-patterns.md`
- [ ] 重い nested select は `Promise.all` で並列クエリ化を検討 → `performance-verification.md`

### サービス別
- [ ] Storage: **Private bucket デフォルト**、`createSignedUrl` で取得 → `storage-rls.md`
- [ ] Storage: `(storage.foldername(name))[1]` でパス判定 → `storage-rls.md`
- [ ] Realtime: DELETE イベントの **RLS バイパス対策**（論理削除 or `INSERT/UPDATE` のみ購読） → `realtime-rls.md`
- [ ] Realtime: `supabase_realtime` publication に追加済み → `realtime-rls.md`

### テスト
- [ ] `pgTAP` で **anon / authenticated(自)/authenticated(他)/service_role × SELECT/INSERT/UPDATE/DELETE = 16 ケース** → `testing-rls.md`
- [ ] クロステナントアクセスが全 4 オペレーションで拒否される → `testing-rls.md`
- [ ] RLS 有効テーブルに対し `supabase/tests/<table>_rls.sql` が存在（カバレッジ監査スクリプト） → `testing-rls.md`
- [ ] `test-db` が CI で PASS してから merge（branch protection で強制） → `testing-rls.md`

### 運用・マイグレーション
- [ ] 既存テーブルへの RLS 追加は **ポリシー CREATE → RLS ENABLE** の順 → `migration-safety.md`
- [ ] DROP POLICY + CREATE POLICY は同一トランザクション → `migration-safety.md`
- [ ] drizzle 生成 SQL を目視レビュー + `lock_timeout` 設定 → `migration-safety.md`
- [ ] ロールバック SQL を事前準備 → `migration-safety.md`

### マルチテナント（該当する場合）
- [ ] すべてのテナント所有テーブルに `tenant_id` 列 + NOT NULL + **複合インデックス** → `multi-tenancy-patterns.md`
- [ ] `tenant_id` は JWT `raw_app_meta_data` 経由、即時剥奪が必要なら DB 参照（マテリアライズド所属） → `multi-tenancy-patterns.md`
- [ ] クライアント側で `.eq('tenant_id', ...)` を必ず付ける → `multi-tenancy-patterns.md`

---

## 禁止パターン（集約）

```sql
-- ❌ auth.uid() をラップしない
USING (auth.uid() = user_id);

-- ❌ TO 省略
CREATE POLICY "..." ON posts USING (...);

-- ❌ UPDATE で WITH CHECK 欠落（なりすまし書き換えが通る）
CREATE POLICY "..." ON posts FOR UPDATE USING (...);

-- ❌ SECURITY DEFINER で search_path 未設定
CREATE FUNCTION f() ... SECURITY DEFINER AS $$ ... $$;

-- ❌ VOLATILE のまま SECURITY DEFINER（毎行実行される）
CREATE FUNCTION f() ... SECURITY DEFINER AS $$ ... $$;  -- STABLE 省略

-- ❌ user_metadata で認可
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ❌ auth.users を JOIN
USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND ...));

-- ❌ RESTRICTIVE のみ（PERMISSIVE なしで全拒否）
CREATE POLICY "..." AS RESTRICTIVE USING (...);
```

```typescript
// ❌ RLS 任せで明示フィルタなし
const { data } = await supabase.from('huge_table').select('*')

// ❌ Private bucket に getPublicUrl
const { data } = supabase.storage.from('private').getPublicUrl(path)

// ❌ Realtime で event: '*'（DELETE が RLS バイパスで届く）
supabase.channel('x').on('postgres_changes', { event: '*', ... }, handler)
```

---

## 新規 RLS 追加時のワークフロー

```
1. どのテーブルに RLS が必要か決める
   └─ public スキーマなら原則すべて必要

2. ポリシーの設計
   ├─ セキュリティ要件 → policy-correctness.md, auth-patterns.md
   ├─ 多段判定あり → security-definer-functions.md
   └─ PII 列あり → column-level-security.md

3. Drizzle スキーマに pgPolicy を定義
   └─ 関数は drizzle/config/post-migration/ に生 SQL で

4. インデックス設計
   └─ indexes-for-rls.md のチェックリスト

5. pgTAP で 4 象限テスト作成（TDD）
   └─ .claude/skills/pgtap/SKILL.md

6. マイグレーション適用依頼（ユーザー承認）
   └─ devenv tasks run app:migrate-dev

7. EXPLAIN (ANALYZE, BUFFERS) で計測
   └─ performance-verification.md のチェックポイント

8. pg_stat_statements で本番継続監視
```

---

## 公式ドキュメント

### 必読
- **[Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)** — 基本・RLS enable・`auth.uid()` / `auth.jwt()`・`bypassrls`、**公式の 6 パフォーマンス推奨事項（indexes / SELECT wrap / client filter / security definer / minimize joins / TO role）とベンチマーク表** を含む
- **[GaryAustin1/RLS-Performance](https://github.com/GaryAustin1/RLS-Performance)** — 公式 Supabase RLS docs から参照されている **正規ベンチマーク repo**（test1-indexed / test2a-wrappedSQL-uid / test2d-sd-fun / test3-addfilter / test5-fixed-join / test6-To-role 等の再現可能な計測スクリプト）
- **[Supabase Discussion #14576](https://github.com/orgs/supabase/discussions/14576)** — 上記ベンチマーク結果の解説（過去の troubleshooting 記事 `rls-performance-and-best-practices-Z5Jjwv` はこの内容に統合・削除済み）
- **[PostgreSQL: CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)** — PERMISSIVE/RESTRICTIVE・USING/WITH CHECK の正式仕様

### SECURITY DEFINER / 関数
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL: CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [PostgreSQL: Function Volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html)

### サービス別
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase: Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)

### パフォーマンス検証
- [PostgreSQL: EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)
- [PostgreSQL: pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [Supabase: index_advisor](https://supabase.com/docs/guides/database/extensions/index_advisor)

---

## 強制事項

このスキルの内容は **交渉の余地なし**。RLS は **セキュリティ境界かつ性能境界** であり、雑な設計は即座にプロダクション障害・情報漏洩につながる。

- 新規 RLS 追加時は必ずマスターチェックリストを通す
- 既存 RLS の修正時も同様にチェックリストを適用
- 判断に迷う場合は勝手に決定せず、**必ずユーザーに判断をあおぐ**
