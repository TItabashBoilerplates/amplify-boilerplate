---
title: Supabase Storage の RLS（storage.objects ポリシー）
category: security
priority: HIGH
---

# Storage RLS

Supabase Storage はファイルメタデータを `storage.objects` テーブルに格納し、**RLS でアクセス制御** する。Private bucket はポリシーなしでは一切アクセス不可。本プロジェクトは `supabase-first.md` の方針により **Private Bucket + Signed URL を既定** とする。

Supabase 公式:
> "Storage does not allow any uploads to buckets without RLS policies"

## 1. 操作と必要パーミッション

| クライアント操作 | 必要な RLS（`storage.objects`） |
|----------------|-------------------------------|
| Upload（新規） | `INSERT` |
| Upload（upsert 更新） | `INSERT` + `SELECT` + `UPDATE` |
| Download（`createSignedUrl` / `download`） | `SELECT` |
| List（`list()`） | `SELECT` |
| Delete（`remove()`） | `DELETE` |
| Move / Copy | `UPDATE` + `SELECT` + `INSERT` |

**ポイント**: 「ダウンロード = SELECT」「アップロード = INSERT」と `storage.objects` への **テーブル権限にマッピングされている** だけ。通常の RLS と同じ作法。

## 2. パス設計（RESTful / 階層）

プロジェクト方針（`supabase-first.md`）に従い、**`{resource}/{id}/{sub}/{filename}`** 形式で保存する。RLS はパス第1セグメントを比較するパターンが基本。

```
users/{user_id}/avatar.png
users/{user_id}/documents/{doc_id}.pdf
projects/{project_id}/assets/logo.png
```

## 3. フォルダ単位の所有者制御（定番パターン）

**「ユーザーは自分のフォルダ配下のみ操作可能」** をパス第1セグメントで判定する。

```sql
-- users/{user_id}/... に対し、本人のみ INSERT / SELECT / UPDATE / DELETE
CREATE POLICY "users_own_folder_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "users_own_folder_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "users_own_folder_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "users_own_folder_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );
```

**重要ポイント**:
- `bucket_id` 比較を忘れない（全 bucket に適用されてしまう）
- `storage.foldername(name)` はパスを配列で返す。`[1]` が第1セグメント（Postgres は 1-indexed）
- `(SELECT auth.jwt() ->> 'sub')` でラップ（パフォーマンス）
- INSERT は `WITH CHECK`、SELECT/DELETE は `USING`、UPDATE は両方（通常 RLS と同じ）

## 4. 所有者列（`owner_id`）ベースの制御

`storage.objects.owner_id` には **アップロード者の user_id** が自動セットされる。フォルダではなくファイル単位で所有者判定したい場合:

```sql
CREATE POLICY "owner_download" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND owner_id = (SELECT auth.uid())  -- owner_id は uuid 型
  );
```

**注意**: `owner_id` が null（service_role で直接 INSERT した場合等）のレコードはこのポリシーでは見えない。設計時にアップロード経路を統一する。

## 5. 組織・チーム単位の制御

`orgs/{org_id}/...` のようなパスで、組織メンバー全員がアクセス可能にする:

```sql
CREATE POLICY "org_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-files'
    AND (SELECT public.is_org_member(
      ((storage.foldername(name))[1])::uuid
    ))
  );
```

`is_org_member` は `security-definer-functions.md` で定義した SECURITY DEFINER 関数。

## 6. Public bucket（例外的運用）

本プロジェクトは原則 Private。Public bucket を使う条件（`supabase-first.md`）:
1. ユーザーが明示的に指定
2. 本当に公開コンテンツ（マーケティング画像、公開ブログ画像等）
3. CDN キャッシュが必要

Public bucket でも `storage.objects` の RLS は適用される。**「誰でもダウンロードできるが、アップロードは認証者のみ」** を書くには:

```sql
-- ダウンロードは誰でも可能（bucket 自体が public）
-- ↑ bucket 側の public flag が true ならこのポリシーは不要

-- アップロードは authenticated のみ
CREATE POLICY "authenticated_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-assets');
```

## 7. Signed URL ベースのダウンロード

Private bucket のファイル取得は `createSignedUrl` で **時間限定 URL** を発行する。

```typescript
// ✅ CORRECT: Private bucket から Signed URL
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(`users/${userId}/invoice.pdf`, 60)  // 60秒有効

if (error) {
  console.error('Signed URL failed:', error)
  throw new Error(error.message)
}
// data.signedUrl を <a href> / <iframe> / fetch に渡す
```

**RLS チェックタイミング**: `createSignedUrl` 実行時に SELECT 権限が評価される。URL 発行後のダウンロードは URL の有効期限内なら RLS を再評価しない。

**禁止**:

```typescript
// ❌ Private bucket に getPublicUrl → 動かない
const { data } = supabase.storage.from('documents').getPublicUrl(path)
```

## 8. config.toml での Bucket 設定

```toml
# supabase/config.toml
[storage.buckets.user-files]
public = false               # ✅ デフォルト Private（必須）
file_size_limit = "50MiB"
allowed_mime_types = ["image/png", "image/jpeg", "application/pdf"]
# objects_path = "users"  # 必要に応じて path prefix

[storage.buckets.public-assets]
public = true                # ⚠️ 明示的にユーザー承認が必要
file_size_limit = "10MiB"
```

## 9. よくある落とし穴

### (a) 複数 bucket で同じポリシー名

`storage.objects` は 1 テーブル。ポリシー名は一意でないと衝突する。`bucket_id` をポリシー名に含めると混乱しない。

```sql
CREATE POLICY "user_files_own_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-files' AND ...);

CREATE POLICY "documents_own_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND ...);
```

### (b) `storage.foldername` のインデックス最適化

`storage.foldername(name)` は式関数。大量ファイル環境で遅い場合は式インデックスを検討:

```sql
-- 第1セグメントだけを抽出する関数に対するインデックス
CREATE INDEX objects_bucket_first_folder_idx
  ON storage.objects (bucket_id, ((storage.foldername(name))[1]));
```

ただし Supabase Cloud では `storage` スキーマへの直接 DDL に制約があるため、必要な場合は Supabase サポートに確認。

### (c) `list()` のページング時の RLS コスト

`supabase.storage.from().list()` は内部で `storage.objects` を SELECT する。RLS + 1万ファイル超の bucket では遅くなる。bucket 分割 or path prefix 指定で絞る:

```typescript
// ✅ path prefix を指定して対象を絞る
const { data } = await supabase.storage.from('user-files').list(`users/${userId}`)
```

## 10. Drizzle / Migration での扱い

`storage.objects` は Supabase Auth/Storage が管理するテーブル。Drizzle スキーマでは定義しない。RLS ポリシーを書く場合は **生の SQL** を `drizzle/config/post-migration/` または新規 `storage-policies.sql` に書き、マイグレーションで適用する。

```sql
-- drizzle/config/storage-policies.sql
CREATE POLICY "user_files_own_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );
-- ... 以下同様
```

## チェックリスト

- [ ] すべての bucket が **Private**（`public = false`）
- [ ] `bucket_id` 比較を各ポリシーに含めている
- [ ] `(storage.foldername(name))[1]` でパス第1セグメント判定
- [ ] `auth.jwt() ->> 'sub'` / `auth.uid()` を `(SELECT ...)` でラップ
- [ ] INSERT は `WITH CHECK`、UPDATE は `USING` + `WITH CHECK` 両方
- [ ] ファイル取得は `createSignedUrl` を使用（`getPublicUrl` は Private で使わない）
- [ ] `storage.foldername` を大量レコードで使う場合は式インデックスを検討
- [ ] pgTAP で authenticated（所有者/非所有者）/ anon / service_role の 4 象限テスト

## 参考

- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Storage Helpers](https://supabase.com/docs/guides/storage/schema/helper-functions) — `storage.foldername()` 等
- [Supabase: Signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- プロジェクト方針: `.claude/rules/supabase-first.md` の Storage Policy セクション
