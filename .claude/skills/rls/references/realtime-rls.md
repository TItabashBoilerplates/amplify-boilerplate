---
title: Supabase Realtime と RLS
category: security + performance
priority: HIGH
---

# Realtime RLS

Supabase Realtime の `postgres_changes` は **RLS を強制する**（= サブスクライバーが見える行のみイベント配信）。ただし **DELETE イベントだけは RLS が効かない** という公式仕様があり、ここがセキュリティ設計の落とし穴。

Supabase 公式:
> "every change event must be checked to see if the subscribed user has access"
> "RLS policies are not applied to `DELETE` statements, because there is no way for Postgres to verify that a user has access to a deleted record"

## 1. 必須セットアップ（3 段階）

### (a) テーブルを `supabase_realtime` publication に追加

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

Drizzle プロジェクトでは `drizzle/config/post-migration/` に書く（現状 Drizzle DSL で publication 操作不可）。

### (b) `REPLICA IDENTITY FULL`（UPDATE / DELETE で旧値を受け取る場合）

デフォルトの `REPLICA IDENTITY DEFAULT` だと、UPDATE の `old_record` / DELETE のレコードが **PK しか含まない**。全列を受け取りたい場合は:

```sql
ALTER TABLE public.messages REPLICA IDENTITY FULL;
```

**トレードオフ**:
- ✅ 旧値全カラムがクライアントに届く
- ❌ WAL サイズが増える（書き込みスループット微減）
- ❌ PII 列を含むテーブルで REPLICA IDENTITY FULL は漏洩リスク → カラム設計に注意

### (c) スキーマが `public` でない場合の GRANT

`public` 以外のスキーマなら `authenticated` ロールに SELECT 権限を付与する必要がある:

```sql
GRANT SELECT ON "private_schema"."messages" TO authenticated;
```

## 2. RLS ポリシーの設計

Realtime は **サブスクライバーが SELECT ポリシーで見える行** のみ配信する。通常の SELECT ポリシーがそのまま効く:

```sql
-- 自チャンネルのメッセージだけ購読できる
CREATE POLICY "read_own_channel" ON public.messages FOR SELECT TO authenticated
  USING ((SELECT public.is_channel_member(channel_id)));
```

**重要**: Realtime の RLS 評価は **イベント1件ごと × サブスクライバー1人ごと** に走る。規模が大きいと RLS コストが乗算される（後述 § 5）。

## 3. DELETE イベントの RLS 非適用 — 重大な落とし穴

### 問題

**DELETE イベントは RLS ポリシーを評価せず全サブスクライバーに配信される**。PII を含むテーブルで DELETE を購読させると、「削除された行の内容が他テナントに見える」セキュリティ事故が発生する。

### 対策

| 対策 | 内容 |
|------|------|
| 1. 削除通知が不要なら **`event: 'INSERT' \| 'UPDATE'` のみ購読** | クライアント側で `event: '*'` を使わない |
| 2. **物理削除をやめて論理削除** にする | `deleted_at` 列で UPDATE イベント化 |
| 3. DELETE を購読するテーブルには **REPLICA IDENTITY FULL を使わない** | PK のみ通知で情報漏洩を最小化 |
| 4. PII を **別テーブルに分離**（`column-level-security.md`）し、PII テーブルは realtime publication に入れない | DELETE で PII が飛ばない |

```typescript
// ✅ GOOD: INSERT / UPDATE のみ
supabase
  .channel('messages')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    handler
  )
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'messages' },
    handler
  )
  .subscribe()

// ⚠️ 注意: * だと DELETE の RLS バイパスイベントも受信する
supabase.channel('x').on('postgres_changes', { event: '*', ... }, handler)
```

### 論理削除パターン（推奨）

```typescript
// drizzle/schema/messages.ts
export const messages = pgTable('messages', {
  id: uuid().primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull(),
  content: text().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // ...
}).enableRLS()

// SELECT ポリシー: 未削除のみ表示
pgPolicy('select_non_deleted', {
  for: 'select',
  to: 'authenticated',
  using: sql`(select public.is_channel_member(channel_id)) AND deleted_at IS NULL`,
})

// UPDATE ポリシー: 削除（= deleted_at セット）
pgPolicy('soft_delete', {
  for: 'update',
  to: 'authenticated',
  using: sql`(select public.can_delete_message(id))`,
  withCheck: sql`(select public.can_delete_message(id))`,
})
```

クライアントは UPDATE イベント経由で `deleted_at` がセットされたことを検知し UI から消す。

## 4. Realtime Authorization（Broadcast / Presence 用）

`postgres_changes` とは別に、Supabase Realtime には Broadcast（任意メッセージ）と Presence（参加者情報）があり、これらも **Realtime Authorization Policies** で制御する。

```sql
-- Realtime Authorization: チャンネル参加権限
CREATE POLICY "can_join_room" ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'room:%'
    AND (SELECT public.is_room_member(split_part(realtime.topic(), ':', 2)::uuid))
  );
```

本スキルでは `postgres_changes` に焦点を当て、Broadcast / Presence の詳細は必要時に公式ドキュメントを参照。

## 5. パフォーマンス — 大規模購読での注意

Supabase 公式:
> "Realtime processes changes on a single thread to maintain order"
> "At scale with RLS filtering, each change triggers authorization checks per subscriber—creating potential database bottlenecks"

### スケール対策

| アプローチ | 使いどころ |
|-----------|-----------|
| **RLS を軽くする** | `(SELECT auth.uid()) = user_id` のような単純比較、インデックス必須 |
| **RLS ヘルパー関数** を SECURITY DEFINER + STABLE で書く | JOIN が必要でも initPlan で 1 回だけ評価 |
| **個人購読 → チャンネル分割** | `room:{id}` 単位にフィルタして subscriber 数を減らす |
| **Public テーブル + 別テーブルで機密** | 公開データは RLS なしテーブルに置き、機密だけ RLS 付きで realtime 購読 |
| **Server-side relay** | バックエンドでイベントを集約し、クライアントに Broadcast で再配信 |

### 典型的な悪化パターン

```sql
-- ❌ 重い RLS を realtime テーブルに付ける
CREATE POLICY "..." ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM channel_members cm
    JOIN orgs o ON o.id = cm.org_id
    JOIN roles r ON r.user_id = cm.user_id
    WHERE cm.channel_id = messages.channel_id
      AND cm.user_id = (SELECT auth.uid())
      AND r.role_name IN ('admin', 'member')
  ));
-- → 1 秒 100 メッセージ × 1000 サブスクライバー = 100,000 回の RLS 評価/秒
```

→ `security-definer-functions.md` のパターンで関数化 + インデックス徹底。

## 6. クライアント側の RLS 依存を最小化

Realtime の RLS は配信時の絞り込み。**クライアントは届いたイベントを検証なしで信じない**。

```typescript
supabase.channel('messages')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
    (payload) => {
      // ✅ クライアント側でも channel_id 等を検証
      if (payload.new && payload.new.channel_id !== currentChannelId) return
      handleNewMessage(payload.new)
    })
  .subscribe()
```

## 7. config.toml / Drizzle 設定

```toml
# supabase/config.toml
[realtime]
enabled = true
```

```sql
-- drizzle/config/post-migration/
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;  -- UPDATE の old_record 必要な場合のみ
```

## チェックリスト

- [ ] Realtime 購読するテーブルは `supabase_realtime` publication に追加済み
- [ ] UPDATE の旧値が必要なら `REPLICA IDENTITY FULL`（不要なら設定しない）
- [ ] DELETE イベントの **RLS バイパス** を理解し、以下のいずれかで対処:
  - 論理削除（`deleted_at` + UPDATE イベント）
  - `event: 'INSERT' | 'UPDATE'` のみ購読
  - PII を別テーブルに分離
- [ ] Realtime テーブルの SELECT ポリシーで `(SELECT auth.uid())` ラップ + インデックス
- [ ] 複雑な RLS は SECURITY DEFINER + STABLE 関数に切り出し
- [ ] スキーマが `public` 以外なら `GRANT SELECT` を `authenticated` に付与
- [ ] クライアント側でも `payload` を検証（RLS だけに頼らない）
- [ ] 大規模購読（数千人超）は server-side relay や channel 分割を検討

## 参考

- [Supabase: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase: Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase: Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts)
- [PostgreSQL: REPLICA IDENTITY](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-REPLICA-IDENTITY)
