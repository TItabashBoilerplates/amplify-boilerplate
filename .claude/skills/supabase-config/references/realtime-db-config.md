# `[realtime]` / `[db]` / `[db.pooler]` / `[db.migrations]` / `[db.seed]` / `[db.network_restrictions]`

DB 本体と Realtime の設定。

## `[realtime]`

```toml
[realtime]
enabled = true
ip_version = "IPv4"      # "IPv4" / "IPv6"
max_header_length = 4096
```

### Realtime を使うテーブル

Publication への追加が必要。`config.toml` ではなく SQL で:

```sql
-- drizzle/config/post-migration/ 等に
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### REPLICA IDENTITY（UPDATE/DELETE のペイロードを完全にする）

```sql
ALTER TABLE public.messages REPLICA IDENTITY FULL;
```

詳細は `.claude/skills/rls/references/realtime-rls.md`。

---

## `[db]`

```toml
[db]
port = 54322
shadow_port = 54320
health_timeout = "2m"
major_version = 17
```

| キー | 説明 |
|------|------|
| `port` | ローカル Postgres のポート |
| `shadow_port` | `supabase db diff` が内部で使う shadow DB |
| `health_timeout` | `supabase start` が待つ起動上限 |
| `major_version` | **本番と合わせること**。Supabase が PG17 を推している |

### 本番の `major_version`

`[remotes.production.db]` で明示:

```toml
[remotes.production.db]
major_version = 17
```

> **破壊的**: マイナーバージョンアップは自動。メジャーアップは Supabase Dashboard での手動操作が必要（`config push` では上げられない）。

---

## `[db.pooler]`（Supavisor / pgBouncer）

```toml
[db.pooler]
enabled = false              # ローカルは false 推奨
port = 54329
pool_mode = "transaction"    # "transaction" / "session"
default_pool_size = 20
max_client_conn = 100
```

### 本番設定

```toml
[remotes.production.db.pooler]
enabled = true
pool_mode = "transaction"
default_pool_size = 25
max_client_conn = 200
```

### 選び方

| 用途 | pool_mode |
|------|-----------|
| Web サーバ / Edge Functions（短時間トランザクション） | `transaction` |
| 長寿命コネクション（LISTEN/NOTIFY、prepared statement） | `session` |
| Serverless（接続嵐） | `transaction` + Supavisor を必須経路に |

**Edge Functions はプール経由が推奨**:

```ts
const pooled = "postgres://postgres.xxx:<pass>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
```

---

## `[db.migrations]`

```toml
[db.migrations]
enabled = true
schema_paths = []   # Drizzle の schema を読ませるなら追加（通常は migrations/ で OK）
```

`schema_paths` は `supabase db reset` 時に追加で実行する SQL の glob。本プロジェクトはマイグレーションを Drizzle 側 (`drizzle/migrations/`) に集約しており、Supabase 側のマイグレーション機構は使わないため空でよい。

---

## `[db.seed]`

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

### 環境別 Seed

```toml
# 本番は Seed 実行しない
[remotes.production.db.seed]
enabled = false

# Staging は専用 Seed
[remotes.staging.db.seed]
enabled = true
sql_paths = ["./seeds/staging.sql"]
```

### 注意

`supabase db reset` は **DB を完全に破棄 → 再作成 + migration + seed**。本番では絶対に実行しない（`scripts/supabase/deploy.sh` は `db push` のみ使う）。

---

## `[db.network_restrictions]`

**本番必須**: DB 接続元 IP 制限。

```toml
[db.network_restrictions]
enabled = false   # ローカルは常に false
allowed_cidrs = ["0.0.0.0/0"]
allowed_cidrs_v6 = ["::/0"]

[remotes.production.db.network_restrictions]
enabled = true
allowed_cidrs = [
  "10.0.0.0/8",           # VPC
  "203.0.113.0/24",       # オフィス
  "198.51.100.0/32",      # Vercel / Edge Functions の特定 IP
]
allowed_cidrs_v6 = [
  "2001:db8::/32",
]
```

> **注意**: PostgREST / GoTrue / Storage API は Supabase 管理ネットワークから接続するため、これらは allowlist に影響しない。制限対象は **直接の Postgres 接続（5432/6543）のみ**。

---

## Schemas

```toml
[api]
schemas = ["public", "graphql_public", "storage"]
extra_search_path = ["public", "extensions"]
```

Drizzle で `public` 以外のスキーマを使うなら、ここに追加すると PostgREST API から見えるようになる。

例: `auth` スキーマの一部を public に露出したい → **推奨しない**。ビューで wrap するか別テーブルに分けるべき。

---

## 禁止パターン

```toml
# ❌ 本番で network_restrictions を空のまま
[remotes.production.db.network_restrictions]
enabled = false  # → 全世界から Postgres 接続可能

# ❌ pooler を本番で enabled = false のまま
[remotes.production.db.pooler]
enabled = false  # → 接続枯渇の原因

# ❌ db.seed.enabled = true を本番に適用
[remotes.production.db.seed]
enabled = true   # → 本番の Seed 上書きリスク
```

---

## 参照

- [Database: Pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Realtime: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Database: Network Restrictions](https://supabase.com/docs/guides/platform/network-restrictions)
- RLS スキル: `.claude/skills/rls/references/realtime-rls.md`
