# `[storage]` / `[storage.buckets.*]` 完全ガイド

Supabase Storage の設定と、**宣言的 Bucket 管理**。`supabase seed buckets --linked` で `config.toml` → Platform に同期。

## 設計原則

1. **デフォルトは Private Bucket**（`public = false`）
2. すべての Bucket に `file_size_limit` / `allowed_mime_types` を設定
3. CLAUDE.md ルール: **Public Bucket はユーザー明示承認が必須**
4. `supabase seed buckets --linked` を CI に組み込む
5. Bucket の削除は `config.toml` の削除では反映されない（手動で削除要）

---

## `[storage]` 基本

```toml
[storage]
enabled = true
file_size_limit = "50MiB"   # プロジェクト全体の上限

[storage.image_transformation]
enabled = true              # 画像変換 API 有効化

[storage.s3_protocol]
enabled = true              # S3 互換クライアント有効化
```

---

## `[storage.buckets.<name>]` 宣言的 Bucket

```toml
[storage.buckets.avatars]
public = false               # ← Private デフォルト
file_size_limit = "5MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]
objects_path = "./storage-seed/avatars"  # ローカル開始時にアップロード

[storage.buckets.documents]
public = false
file_size_limit = "20MiB"
allowed_mime_types = ["application/pdf"]

[storage.buckets.assets]
public = true                # ← 公開アセットのみ
file_size_limit = "10MiB"
allowed_mime_types = ["image/*"]

[storage.buckets.private-uploads]
public = false
file_size_limit = "50MiB"
# allowed_mime_types を省略 = 全 MIME 許可（非推奨）
```

### キー詳細

| キー | 型 | 説明 |
|------|----|------|
| `public` | bool | true = 誰でも Public URL でアクセス可。false = Signed URL 必須 |
| `file_size_limit` | string | `"5MB"` / `"500KB"` / `"50MiB"` 等。プロジェクト上限以下 |
| `allowed_mime_types` | string[] | `["image/png", "image/*"]`。空 or 未指定 = 全許可 |
| `objects_path` | string | ローカル dir。`supabase seed buckets --local` で自動アップロード |

---

## Bucket 同期コマンド

### ローカル

```bash
supabase seed buckets --local
```

### リモート（CI/CD）

```bash
# supabase link 後に
supabase seed buckets --linked
```

`config.toml` に宣言された Bucket が無ければ作成、既存なら設定更新。

### 本プロジェクトの scripts

`scripts/supabase/deploy-buckets.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ENV="${ENV:-}"
if [ "$ENV" = "local" ] || [ -z "$ENV" ]; then
    echo "⚠️  Skipping for local environment"
    exit 0
fi
echo "🪣 Syncing Storage Buckets..."
supabase seed buckets --linked
```

---

## RLS ポリシー（Bucket 作成だけでは不十分）

Bucket の作成だけでは誰もアクセスできない。`storage.objects` に RLS ポリシーを書く必要がある。

詳細は `.claude/skills/rls/references/storage-rls.md` を参照。

```sql
-- drizzle/config/storage-policies.sql の例
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT TO authenticated, anon
USING (bucket_id = 'avatars');
```

---

## 画像変換

```toml
[storage.image_transformation]
enabled = true
```

クライアント側:

```typescript
const { data } = await supabase.storage
  .from('avatars')
  .createSignedUrl(path, 60, {
    transform: {
      width: 200,
      height: 200,
      resize: 'cover',
      quality: 80,
    },
  })
```

---

## S3 Protocol

```toml
[storage.s3_protocol]
enabled = true
```

AWS SDK / s3cmd / rclone で操作可能:

```typescript
import { S3Client } from "@aws-sdk/client-s3"

const client = new S3Client({
  endpoint: "https://<project-ref>.supabase.co/storage/v1/s3",
  region: "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
})
```

### 認証情報

Platform（本番）側の認証情報は Dashboard → Storage → S3 Access Keys で発行する。`config.toml` には書けない。

---

## Storage Analytics（ETL / DW）

```toml
[storage.analytics]
enabled = true
max_namespaces = 5
max_tables = 10
max_catalogs = 2
```

Platform-only 機能（ローカルでは動かない）。Apache Iceberg / DuckDB ベースの分析用。

---

## Storage Vector（埋め込み）

```toml
[storage.vector]
enabled = true
max_buckets = 10
max_indexes = 5
```

pgvector ベースの Vector 検索用。こちらも Platform-only。

---

## 本プロジェクト想定の Bucket 設計

CLAUDE.md の `.claude/rules/supabase-first.md` に従い:

| Bucket | public | 用途 | パス規約 |
|--------|--------|------|---------|
| `avatars` | false | ユーザーアバター | `{user_id}/avatar.{ext}` |
| `documents` | false | アップロードドキュメント | `users/{user_id}/documents/{doc_id}.{ext}` |
| `assets` | true | ランディングページ素材 | `public/*` |
| `project-files` | false | プロジェクト添付 | `projects/{project_id}/files/{file_id}` |

```toml
[storage.buckets.avatars]
public = false
file_size_limit = "5MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]

[storage.buckets.documents]
public = false
file_size_limit = "20MiB"
allowed_mime_types = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

[storage.buckets.assets]
public = true
file_size_limit = "10MiB"
allowed_mime_types = ["image/*"]

[storage.buckets.project-files]
public = false
file_size_limit = "50MiB"
```

---

## 禁止パターン

```toml
# ❌ 未指定 file_size_limit（プロジェクト上限 = DoS 経路）
[storage.buckets.uploads]
public = false

# ❌ allowed_mime_types 空で Public
[storage.buckets.public]
public = true
# → 任意 MIME の実行可能ファイルをホスティング可能に

# ❌ ユーザー明示承認なしで public = true
[storage.buckets.user-uploads]
public = true   # CLAUDE.md 違反
```

```typescript
// ❌ Private Bucket に getPublicUrl（動かない）
const { data } = supabase.storage.from('avatars').getPublicUrl(path)

// ✅ createSignedUrl
const { data, error } = await supabase.storage
  .from('avatars')
  .createSignedUrl(path, 60)
if (error) throw new Error(error.message)
```

---

## 運用

### Bucket の削除

`config.toml` から `[storage.buckets.xxx]` を消しても、リモートは削除されない。**Dashboard か API で明示削除**:

```bash
# API 経由（service_role key が必要）
curl -X DELETE "https://<ref>.supabase.co/storage/v1/bucket/xxx" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

### Bucket の改名

改名は API に無い。**新 Bucket 作成 → 中身コピー → 旧 Bucket 削除**。

---

## 参照

- [Storage: Creating Buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Storage: File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Storage Access Control（RLS）](https://supabase.com/docs/guides/storage/security/access-control)
- RLS スキル: `.claude/skills/rls/references/storage-rls.md`
