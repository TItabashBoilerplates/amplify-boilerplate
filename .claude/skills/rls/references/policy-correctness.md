---
title: ポリシー正しさ — USING vs WITH CHECK・PERMISSIVE/RESTRICTIVE
category: security
priority: CRITICAL
---

# Policy Correctness（ポリシーの正しさ）

RLS の脆弱性の大半は「`USING` と `WITH CHECK` の取り違え」「PERMISSIVE/RESTRICTIVE の誤解」から生まれる。
**正しくないポリシーは、速くしても意味がない**。

## 1. USING vs WITH CHECK マトリクス

PostgreSQL 公式の正確なマッピング:

| コマンド | `USING` の用途 | `WITH CHECK` の用途 |
|---------|---------------|---------------------|
| **SELECT** | 行のフィルタ（見える行） | N/A |
| **INSERT** | N/A | 新規行の検証（false/null で **エラー**） |
| **UPDATE** | 更新対象行のフィルタ | 更新後の状態を検証（false/null で **エラー**） |
| **DELETE** | 削除対象行のフィルタ | N/A |
| **ALL** | 上記すべて（`WITH CHECK` 省略時は `USING` を INSERT/UPDATE でも使用） | 同左 |

**重要な挙動の違い**:
- `USING` が false/null → **行がサイレントに除外**（例外なし）
- `WITH CHECK` が false/null → **明示的エラー**（コマンド全体が abort）

### UPDATE は両方必要

UPDATE は「更新できる行」と「更新後の状態」の2段階検証が必要。**`USING` だけだと、既存行は自分のものだが他人の `user_id` に書き換えるような**なりすまし攻撃**が通る**。

```sql
-- ❌ BAD: WITH CHECK なし → 他人の user_id への書き換えが通る
CREATE POLICY "update_own" ON posts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 攻撃例（成立してしまう）:
UPDATE posts SET user_id = '<other_user>' WHERE id = '<my_post>';

-- ✅ GOOD: WITH CHECK で更新後も自分の所有であることを検証
CREATE POLICY "update_own" ON posts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

Drizzle:

```typescript
pgPolicy('update_own_post', {
  for: 'update',
  to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
  withCheck: sql`(select auth.uid()) = user_id`,  // 必須
})
```

### INSERT は `WITH CHECK` のみ

```typescript
pgPolicy('insert_own_post', {
  for: 'insert',
  to: 'authenticated',
  withCheck: sql`(select auth.uid()) = user_id`,
  // using は書かない
})
```

### `FOR ALL` は両方にかかる

`FOR ALL` で `using` のみ指定すると、INSERT/UPDATE の WITH CHECK にも同じ式が使われる。明示的に別にしたい場合は `for: 'insert'` / `for: 'update'` を分ける。

## 2. PERMISSIVE vs RESTRICTIVE — 組み合わせの仕様

PostgreSQL 公式:

```
(PERMISSIVE policy 1 OR PERMISSIVE policy 2 OR ...)
AND
(RESTRICTIVE policy 1 AND RESTRICTIVE policy 2 AND ...)
```

| 種類 | デフォルト | 結合 | 用途 |
|------|-----------|------|------|
| **PERMISSIVE** | ✅ | **OR** | 許可条件の **追加** |
| **RESTRICTIVE** | | **AND** | 絶対条件の **強制** |

**重要**: RESTRICTIVE だけだと **全拒否**。PERMISSIVE が少なくとも1つ必要。

### 設計方針

**基本**: PERMISSIVE を 1 コマンドあたり最小数（理想は1つ）。
**RESTRICTIVE の用途**: 「どんな PERMISSIVE があっても絶対に許可しない」絶対条件のみ。

```sql
-- PERMISSIVE: 通常の許可（所有者か組織メンバーなら見える）
CREATE POLICY "member_read" ON documents FOR SELECT TO authenticated AS PERMISSIVE
  USING ((SELECT is_org_member(org_id)));

-- RESTRICTIVE: 退会ユーザーは絶対に見せない（PERMISSIVE の結果をさらに絞る）
CREATE POLICY "active_only" ON documents FOR SELECT TO authenticated AS RESTRICTIVE
  USING ((SELECT is_active_user()));

-- RESTRICTIVE: PII 列を含むクエリは 2FA 必須
CREATE POLICY "require_mfa_for_pii" ON users FOR SELECT TO authenticated AS RESTRICTIVE
  USING ((SELECT auth.jwt() ->> 'aal') = 'aal2');
```

### 複数 PERMISSIVE の落とし穴

同じコマンドに PERMISSIVE が複数ある場合、**すべてが毎回評価** される（短絡評価は Postgres に任せるべきで、保証されない）。1 つの関数にまとめて明示的に短絡したほうが速い。

→ 詳細は `security-definer-functions.md` 参照

## 3. コマンド型混在時の評価

複数の異なるコマンド型ポリシーが効くケース（例: UPDATE 時に SELECT + UPDATE ポリシー両方が効く）:

```
[SELECT の RESTRICTIVE] AND [SELECT の PERMISSIVE(OR 結合)] AND
[UPDATE の RESTRICTIVE] AND [UPDATE の PERMISSIVE(OR 結合)]
```

UPDATE で `SELECT` ポリシーも評価されるのは、「更新対象行を特定する」ために SELECT の可視性判定が必要だから。

## 4. `TO` 句は必ず明示

`TO` を省略すると **PUBLIC（全ロール）** に適用される。公式ベンチマーク: **anon の処理コストを 170ms → <0.1ms** に削減できる。

```sql
-- ❌ BAD: TO 省略 → 全ロールで評価（anon にもコストがかかる）
CREATE POLICY "..." ON posts FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ✅ GOOD: authenticated のみ評価
CREATE POLICY "..." ON posts FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ✅ GOOD: 公開情報は anon も含める（明示的に）
CREATE POLICY "public_read" ON posts FOR SELECT TO anon, authenticated USING (is_public = true);
```

## 5. コマンドを分割する原則

`FOR ALL` は読みやすいが、SELECT/INSERT/UPDATE/DELETE で **条件が異なる場合は分割必須**。

```typescript
// ✅ 分割例: 閲覧は広く、書き込みは狭く
pgPolicy('read_public', {
  for: 'select',
  to: ['anon', 'authenticated'],
  using: sql`is_public = true OR (select auth.uid()) = user_id`,
})

pgPolicy('insert_own', {
  for: 'insert',
  to: 'authenticated',
  withCheck: sql`(select auth.uid()) = user_id`,
})

pgPolicy('update_own', {
  for: 'update',
  to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
  withCheck: sql`(select auth.uid()) = user_id`,
})

pgPolicy('delete_own', {
  for: 'delete',
  to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
})
```

## チェックリスト

- [ ] UPDATE ポリシーに `USING` と `WITH CHECK` **両方** が指定されている
- [ ] INSERT ポリシーは `WITH CHECK` のみ（`USING` は不要）
- [ ] DELETE/SELECT ポリシーは `USING` のみ（`WITH CHECK` は書かない）
- [ ] すべてのポリシーで `TO` ロールを明示（`anon` / `authenticated` / 特定ロール）
- [ ] RESTRICTIVE を使う場合、少なくとも 1 つの PERMISSIVE が同じコマンドに存在する
- [ ] 読み/書きで条件が異なる場合、`FOR ALL` ではなくコマンド別に分割している
- [ ] `pgTAP` で許可ケース（`lives_ok`）と拒否ケース（`throws_ok` / `is_empty`）の両方を検証

## 禁止パターン

```sql
-- ❌ UPDATE で WITH CHECK 欠落（なりすまし書き換えが通る）
CREATE POLICY "..." ON posts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ❌ INSERT で USING を書く（効かない・紛らわしい）
CREATE POLICY "..." ON posts FOR INSERT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ❌ RESTRICTIVE だけ定義（全拒否になる）
CREATE POLICY "..." ON posts FOR SELECT TO authenticated AS RESTRICTIVE
  USING ((SELECT is_active_user()));
  -- PERMISSIVE がないと何も見えない

-- ❌ TO 省略（全ロールで評価される）
CREATE POLICY "..." ON posts FOR SELECT USING (...);
```

## 参考

- [PostgreSQL: CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html) — PERMISSIVE/RESTRICTIVE の結合仕様、USING/WITH CHECK の正式定義
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
