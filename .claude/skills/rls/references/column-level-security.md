---
title: カラムレベルセキュリティ（PII 列の保護）
category: security
priority: HIGH
---

# Column-Level Security

RLS は **行単位** の制御。カラム（列）単位で「この列は admin だけに見せる」「この列は 2FA 済みのみ」といった制御をしたい場合、追加の仕組みが必要。

代表的アプローチ:
1. **GRANT SELECT (col)** — カラム権限で直接制御
2. **VIEW + RLS** — 列を分離したビューに RLS を貼る
3. **別テーブル分割** — PII 列を別テーブルに切り出して RLS
4. **RESTRICTIVE ポリシー** — 「特定条件下では列参照を拒否」

## 1. カラム権限（`GRANT SELECT (col)`）

ロール単位で特定列への参照を制限できる。

```sql
-- 通常列は authenticated 全員に
GRANT SELECT (id, name, email) ON public.users TO authenticated;

-- 機密列（phone, ssn）は admin ロールのみ
GRANT SELECT (phone, ssn) ON public.users TO admin_role;

-- authenticated は phone/ssn への SELECT 権限なし
-- → SELECT phone FROM users は permission denied
```

**制約**:
- Supabase の JWT ロールは通常 `authenticated` / `anon` のみ。カスタムロールを作るには DB 側の GRANT が必要
- PostgREST 経由で `select=*` すると権限ない列でエラーになる
- 列を追加したとき GRANT を忘れるとアクセスできなくなる

## 2. VIEW で列を分離

機密列を含まないビューを作り、そのビューを公開する。

```sql
-- 元テーブル: users（RLS 有効、service_role のみ直接アクセス可能な運用）
REVOKE SELECT ON public.users FROM authenticated, anon;

-- 公開ビュー: 機密列を除外
CREATE OR REPLACE VIEW public.users_public
WITH (security_invoker = true)  -- 呼び出し元の権限で実行（RLS が効く）
AS
SELECT id, name, email, avatar_url FROM public.users;

GRANT SELECT ON public.users_public TO authenticated;
```

**重要**: `security_invoker = true`（Postgres 15+）を指定しないと、ビュー所有者（通常 `postgres`）の権限で実行され RLS がバイパスされる。

### admin 専用ビュー

```sql
CREATE OR REPLACE VIEW public.users_admin
WITH (security_invoker = true)
AS
SELECT * FROM public.users;  -- 全列
-- アクセスは元テーブルの RLS で制御
-- RLS: USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
```

## 3. 別テーブル分割（推奨パターン）

**PII 列を別テーブルに切り出す** のが最もクリーン。

```typescript
// drizzle/schema/users.ts
export const users = pgTable('users', {
  id: uuid().primaryKey(),
  name: text().notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
}).enableRLS()

// 機密情報は別テーブル
export const userPii = pgTable('user_pii', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  email: text().notNull(),
  phone: text(),
  ssn: text(),
}).enableRLS()

// users: 広いアクセス
pgPolicy('users_public_read', {
  for: 'select',
  to: ['anon', 'authenticated'],
  using: sql`true`,
}).link(users)

// user_pii: 本人のみ
pgPolicy('user_pii_self', {
  for: 'select',
  to: 'authenticated',
  using: sql`(select auth.uid()) = user_id`,
}).link(userPii)
```

**メリット**:
- 誰が何にアクセスできるか明確
- RLS が単純（JOIN なし）= 高速
- PII をバックアップや監査ログから自然に分離可能
- nested select / RPC で PII を意図せず露出するリスク低減

## 4. RESTRICTIVE で「特定条件下では列ではなく行全体を拒否」

「2FA 未認証なら PII 列を含むクエリを拒否」のような強制は、RESTRICTIVE で行ごと拒否するのが実装しやすい。

```sql
-- 通常の PERMISSIVE
CREATE POLICY "own_read" ON public.user_pii FOR SELECT TO authenticated AS PERMISSIVE
  USING ((SELECT auth.uid()) = user_id);

-- RESTRICTIVE: 2FA (AAL2) 必須
CREATE POLICY "require_aal2" ON public.user_pii FOR SELECT TO authenticated AS RESTRICTIVE
  USING ((SELECT auth.jwt() ->> 'aal') = 'aal2');
```

AAL = Authentication Assurance Level（Supabase MFA の概念）。`aal1` = password、`aal2` = MFA 済み。

## 5. 監査ログ観点

PII カラムへのアクセスを記録したい場合:

```sql
-- SELECT 時にトリガーは発火しない（Postgres の制約）
-- → 代わりに監査テーブル + RLS + RPC で入口を縛る

CREATE OR REPLACE FUNCTION public.get_user_pii(p_user_id uuid)
RETURNS user_pii LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
DECLARE
  result user_pii;
BEGIN
  -- 認可チェック
  IF (SELECT auth.uid()) <> p_user_id
     AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin'
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- アクセス監査
  INSERT INTO audit_log (actor_id, action, target_id)
  VALUES ((SELECT auth.uid()), 'read_user_pii', p_user_id);

  SELECT * INTO result FROM user_pii WHERE user_id = p_user_id;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_pii(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_pii(uuid) TO authenticated;
```

## 6. 選択ガイド

| 要件 | 推奨アプローチ |
|------|---------------|
| 単純に「admin だけ見える列」 | **VIEW + security_invoker + RLS** |
| マルチテナント + PII 分離 | **別テーブル分割**（最推奨） |
| 2FA/AAL による制限 | **RESTRICTIVE ポリシー** |
| アクセス監査が必要 | **RPC（SECURITY DEFINER）+ 監査ログ INSERT** |
| ロール厳密運用 | `GRANT SELECT (col)`（列権限） |

## チェックリスト

- [ ] PII 列は **別テーブルに分離** を検討したか
- [ ] ビュー経由で公開する場合 `WITH (security_invoker = true)` を必ず指定
- [ ] 列権限（`GRANT SELECT (col)`）を使う場合、列追加時の権限漏れを監査する運用がある
- [ ] 2FA 要件がある場合、AAL2 を RESTRICTIVE で強制している
- [ ] PII アクセスの監査要件があれば RPC + audit_log パターンで入口を集約

## 参考

- [PostgreSQL: Column Privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
- [PostgreSQL: CREATE VIEW — security_invoker](https://www.postgresql.org/docs/current/sql-createview.html) — PG15+
- [Supabase: MFA / AAL](https://supabase.com/docs/guides/auth/auth-mfa) — AAL1 / AAL2 の使い分け
