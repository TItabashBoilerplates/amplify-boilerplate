# config.toml 完全リファレンス

Supabase CLI v2 系の公式テンプレートに基づく `supabase/config.toml` の全セクション・全キー。デフォルト値と用途を明記する。

> ソース: [supabase/cli/pkg/config/templates/config.toml](https://github.com/supabase/cli/blob/develop/pkg/config/templates/config.toml)

## ルート

```toml
# プロジェクト識別子（同一ホスト上で複数プロジェクトを区別するためのキー）
project_id = "your-project-name"
```

---

## `[api]`

PostgREST を介した REST API。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | API サーバ有効化 |
| `port` | int | `54321` | API サーバポート |
| `schemas` | string[] | `["public", "graphql_public"]` | API が公開するスキーマ |
| `extra_search_path` | string[] | `["public", "extensions"]` | 追加 search_path |
| `max_rows` | int | `1000` | View/Table/RPC が返す最大行数 |

### `[api.tls]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `false` | 自己署名証明書で HTTPS 有効化 |
| `cert_path` | string | — | 証明書ファイルパス |
| `key_path` | string | — | 秘密鍵ファイルパス |

---

## `[db]`

PostgreSQL 本体。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `port` | int | `54322` | DB 接続ポート |
| `shadow_port` | int | `54320` | diff 用 shadow DB ポート |
| `health_timeout` | string | `"2m"` | 起動ヘルスチェックタイムアウト |
| `major_version` | int | `17` | Postgres メジャーバージョン |

### `[db.pooler]` — Supavisor / pgBouncer

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `false` | プーラー有効化 |
| `port` | int | `54329` | プーラーポート |
| `pool_mode` | string | `"transaction"` | `transaction` / `session` |
| `default_pool_size` | int | `20` | user/DB ペアあたりの接続数 |
| `max_client_conn` | int | `100` | 最大クライアント接続数 |

### `[db.migrations]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | `supabase db reset` でマイグレーション適用 |
| `schema_paths` | string[] | `[]` | マイグレーション外で読む SQL の glob（Drizzle 連携で使用） |

### `[db.seed]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | `supabase db reset` で Seed 実行 |
| `sql_paths` | string[] | `["./seed.sql"]` | Seed SQL のパス |

### `[db.network_restrictions]` — Remote only（Staging/Prod）

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `false` | CIDR 制限有効化 |
| `allowed_cidrs` | string[] | `["0.0.0.0/0"]` | IPv4 allowlist |
| `allowed_cidrs_v6` | string[] | `["::/0"]` | IPv6 allowlist |

---

## `[realtime]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | Realtime 有効化 |
| `ip_version` | string | `IPv4` | `IPv4` / `IPv6` |
| `max_header_length` | int | `4096` | ヘッダ最大バイト |

---

## `[studio]`

ローカル Supabase Studio。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | Studio 有効化 |
| `port` | int | `54323` | Studio ポート |
| `api_url` | string | `"http://127.0.0.1"` | フロントから API への接続 URL |
| `openai_api_key` | string | `"env(OPENAI_API_KEY)"` | AI アシスト機能用 |

---

## `[inbucket]`

ローカル用メールテストサーバ。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | Inbucket 有効化 |
| `port` | int | `54324` | Web UI ポート |
| `smtp_port` | int | `54325` | SMTP サーバポート（任意） |
| `pop3_port` | int | `54326` | POP3 ポート（任意） |
| `admin_email` | string | — | 送信元 From アドレス |
| `sender_name` | string | — | 送信者名 |

---

## `[storage]`

詳細は [storage-config.md](storage-config.md) を参照。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | Storage 有効化 |
| `file_size_limit` | string | `"50MiB"` | プロジェクト全体のファイルサイズ上限 |

### `[storage.image_transformation]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | 画像変換 API 有効化 |

### `[storage.s3_protocol]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | S3 互換プロトコル有効化 |

### `[storage.analytics]` — Platform only

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `false` | ETL データウェアハウス |
| `max_namespaces` | int | `5` | — |
| `max_tables` | int | `10` | — |
| `max_catalogs` | int | `2` | — |

### `[storage.vector]` — Platform only

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `false` | Vector 埋め込み用 Storage |
| `max_buckets` | int | `10` | — |
| `max_indexes` | int | `5` | — |

### `[storage.buckets.<name>]`

宣言的 Bucket 定義。`supabase seed buckets --linked` / `--local` で同期。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `public` | bool | `false` | Public/Private |
| `file_size_limit` | string | — | `"5MB"` 等（プロジェクト上限以下） |
| `allowed_mime_types` | string[] | — | 例: `["image/png", "image/jpeg"]` |
| `objects_path` | string | — | ローカルから初期アップロードする dir |

---

## `[auth]`

詳細は [auth-config.md](auth-config.md) を参照。主要キーのみ:

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | GoTrue 有効化 |
| `site_url` | string | `"http://127.0.0.1:3000"` | サイトベース URL |
| `additional_redirect_urls` | string[] | `["https://127.0.0.1:3000"]` | リダイレクト allowlist |
| `jwt_expiry` | int | `3600` | JWT 有効秒（max 604800） |
| `enable_refresh_token_rotation` | bool | `true` | Refresh Token ローテーション |
| `refresh_token_reuse_interval` | int | `10` | 再利用猶予秒 |
| `enable_signup` | bool | `true` | サインアップ許可 |
| `enable_anonymous_sign_ins` | bool | `false` | 匿名サインイン |
| `enable_manual_linking` | bool | `false` | 手動アカウントリンク |
| `minimum_password_length` | int | `6` | パスワード最低長 |
| `password_requirements` | string | `""` | パスワード要件パターン |

### `[auth.rate_limit]`

| キー | デフォルト | 単位 |
|------|-----------|------|
| `email_sent` | `2` | /時 |
| `sms_sent` | `30` | /時 |
| `anonymous_users` | `30` | /時 /IP |
| `token_refresh` | `150` | /5分 /IP |
| `sign_in_sign_ups` | `30` | /5分 /IP |
| `token_verifications` | `30` | /5分 |
| `web3` | `30` | /5分 /IP |

### `[auth.email]`

| キー | デフォルト | 説明 |
|------|-----------|------|
| `enable_signup` | `true` | Email サインアップ |
| `double_confirm_changes` | `true` | 新旧両方で確認 |
| `enable_confirmations` | `false` | ログイン前確認メール必須 |
| `secure_password_change` | `false` | パスワード変更時の再認証 |
| `max_frequency` | `"1s"` | 確認メール最短間隔 |
| `otp_length` | `6` | Email OTP 長 |
| `otp_expiry` | `3600` | OTP 有効秒 |

### `[auth.sms]`

| キー | デフォルト |
|------|-----------|
| `enable_signup` | `false` |
| `enable_confirmations` | `false` |
| `template` | `"Your code is {{ .Code }}"` |
| `max_frequency` | `"5s"` |

### `[auth.mfa]`

```toml
[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false

[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false
otp_length = 6
template = "Your code is {{ .Code }}"
max_frequency = "5s"
```

### `[auth.external.<provider>]`

Provider 例: `apple` / `azure` / `bitbucket` / `discord` / `facebook` / `figma` / `github` / `gitlab` / `google` / `kakao` / `keycloak` / `linkedin_oidc` / `notion` / `twitch` / `twitter` / `slack_oidc` / `spotify` / `workos` / `zoom`

| キー | 型 | 説明 |
|------|----|------|
| `enabled` | bool | — |
| `client_id` | string | OAuth Client ID |
| `secret` | string | **必ず `env()` 経由** |
| `redirect_uri` | string | 既定の上書き |
| `url` | string | 既定プロバイダ URL 上書き |
| `skip_nonce_check` | bool | Google ローカル用 |
| `email_optional` | bool | — |

### `[auth.hook.<hook_name>]`

`hook_name`: `custom_access_token` / `send_sms` / `send_email` / `mfa_verification_attempt` / `password_verification_attempt`

```toml
[auth.hook.send_email]
enabled = true
uri = "http://host.docker.internal:54321/functions/v1/send-email"
secrets = "env(SUPABASE_AUTH_HOOK_SEND_EMAIL_SECRETS)"
```

`uri` は `pg-functions://postgres/<schema>/<function_name>` か HTTP(S) URL。

### `[auth.third_party.*]`

```toml
[auth.third_party.firebase]
enabled = false
project_id = ""

[auth.third_party.auth0]
enabled = false
tenant = ""
tenant_region = ""

[auth.third_party.aws_cognito]
enabled = false
user_pool_id = ""
user_pool_region = ""

[auth.third_party.clerk]
enabled = false
domain = ""
```

### `[auth.web3.solana]`

| キー | デフォルト |
|------|-----------|
| `enabled` | `false` |

### `[auth.oauth_server]`

| キー | デフォルト | 説明 |
|------|-----------|------|
| `enabled` | `false` | Supabase を OAuth サーバとして公開 |
| `authorization_url_path` | `"/oauth/consent"` | 同意画面パス |
| `allow_dynamic_registration` | `false` | 動的クライアント登録 |

---

## `[edge_runtime]`

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | Edge Runtime 有効化 |
| `policy` | string | `"per_worker"` | `per_worker`（プロダクション） / `oneshot`（hot reload 開発用） |
| `inspector_port` | int | `8083` | Chrome DevTools ポート |
| `deno_version` | int | `2` | Deno メジャーバージョン |

---

## `[analytics]`

| キー | デフォルト | 説明 |
|------|-----------|------|
| `enabled` | `true` | Logflare 有効化 |
| `port` | `54327` | — |
| `backend` | `"postgres"` | `postgres` / `bigquery` |

---

## `[functions.<name>]`

詳細は [functions-config.md](functions-config.md) を参照。

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `enabled` | bool | `true` | `false` にするとデプロイ対象から除外 |
| `verify_jwt` | bool | `true` | false にすると未認証でも呼べる（Webhook 向け） |
| `import_map` | string | — | 例: `"./functions/x/import_map.json"` |
| `entrypoint` | string | — | 例: `"./functions/x/index.ts"` |
| `static_files` | string[] | — | 静的アセット（glob 可） |

---

## `[experimental]`

OrioleDB 等の実験的機能。

```toml
[experimental]
orioledb_version = ""
s3_host = "env(S3_HOST)"
s3_region = "env(S3_REGION)"
s3_access_key = "env(S3_ACCESS_KEY)"
s3_secret_key = "env(S3_SECRET_KEY)"

# [experimental.pgdelta]  # 宣言的スキーマエンジン（beta）
# enabled = false
# declarative_schema_path = "./database"
```

---

## `[remotes.<project_id>]`

マルチ環境設定。詳細は [multi-environment.md](multi-environment.md)。

```toml
[remotes.staging]
project_id = "abcdefghijklmnopqrst"

[remotes.staging.auth]
site_url = "https://staging.example.com"

[remotes.staging.db.seed]
enabled = true
sql_paths = ["./seeds/staging.sql"]

[remotes.production]
project_id = "uvwxyzabcdefghijklmn"

[remotes.production.auth]
site_url = "https://example.com"

[remotes.production.db]
pool_size = 25

[remotes.production.api]
max_rows = 500
```

> ルート直下に書いた値が全環境のデフォルト、`[remotes.{name}.*]` がその環境での上書き。

---

## `supabase init` 時の既定ファイル

```
supabase/
├── config.toml          # このファイル
├── seed.sql             # [db.seed] が参照
├── migrations/          # supabase db push が参照
├── functions/
│   └── <name>/index.ts  # [functions.<name>] で個別設定
└── tests/               # pgTAP テスト
```

## ポート一覧（デフォルト）

| サービス | ポート | 備考 |
|---------|--------|------|
| API | 54321 | PostgREST |
| DB | 54322 | Postgres |
| Shadow DB | 54320 | diff 用 |
| Studio | 54323 | Web UI |
| Inbucket (HTTP) | 54324 | メール確認 |
| Inbucket (SMTP) | 54325 | — |
| Inbucket (POP3) | 54326 | — |
| Analytics | 54327 | Logflare |
| Pooler | 54329 | Supavisor |
| Edge Inspector | 8083 | DevTools |

---

## 参照

- [公式 config reference](https://supabase.com/docs/guides/cli/config)
- [テンプレート（develop ブランチ）](https://github.com/supabase/cli/blob/develop/pkg/config/templates/config.toml)
