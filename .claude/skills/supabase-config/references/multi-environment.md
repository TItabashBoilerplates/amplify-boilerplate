# マルチ環境: `[remotes.*]` と dotenvx

本プロジェクトは **`ENV={local, stg, prod}` 戦略** と **`[remotes.<project_id>]`** を組み合わせる。どちらか一方で十分な場合もあるが、併用で再現性が最も高い。

## 戦略 A: `[remotes.<project_id>]` 方式（推奨）

1 個の `supabase/config.toml` にすべての環境差分を書く。**Staging 用設定を本番に適用してしまう事故を構造的に防げる**。

### 基本形

```toml
# ===== 全環境共通のベース =====
project_id = "shadcn-boilerplate"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
max_rows = 1000

[auth]
enabled = true
jwt_expiry = 3600
enable_refresh_token_rotation = true
minimum_password_length = 12

# ローカル開発用のデフォルト
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["http://localhost:3000", "http://127.0.0.1:3000"]

[auth.email]
enable_confirmations = false  # ローカルはメール確認スキップ

# ===== Staging 上書き =====
[remotes.staging]
project_id = "abcdefghij1234567890"   # ← Supabase Dashboard の Project Ref

[remotes.staging.auth]
site_url = "https://staging.example.com"
additional_redirect_urls = [
  "https://staging.example.com",
  "https://*-staging.example.com",   # プレビュー URL 等
]

[remotes.staging.auth.email]
enable_confirmations = true

[remotes.staging.api]
max_rows = 500

[remotes.staging.db.seed]
enabled = true
sql_paths = ["./seeds/staging.sql"]

# ===== Production 上書き =====
[remotes.production]
project_id = "uvwxyzabcd0987654321"

[remotes.production.auth]
site_url = "https://example.com"
additional_redirect_urls = ["https://example.com"]

[remotes.production.auth.email]
enable_confirmations = true
secure_password_change = true

[remotes.production.auth.rate_limit]
email_sent = 10           # 本番は厳しめ
sign_in_sign_ups = 15
token_refresh = 300

[remotes.production.db]
major_version = 17

[remotes.production.db.network_restrictions]
enabled = true
allowed_cidrs = [
  "10.0.0.0/8",      # VPC
  "203.0.113.0/24",  # オフィス
]

[remotes.production.db.pooler]
enabled = true
default_pool_size = 25
max_client_conn = 200
```

### `supabase config push` の挙動

- `supabase link --project-ref <ref>` でリンクされた環境を特定
- `config push` はリンク先の `project_id` に一致する `[remotes.<name>]` を自動マージして適用
- ルート直下の値がベース、`[remotes.<name>.<section>]` が上書き

### 落とし穴

- `[remotes.staging.auth]` で `enable_signup = false` と書いたが、ルート `[auth]` は `enable_signup = true` のまま → **Staging には false で反映**（上書きが効く）
- `[remotes.staging.auth]` **セクションごと未定義** のキーはルートのデフォルトが使われる
- **配列値（`additional_redirect_urls`）は置換、マージではない**

---

## 戦略 B: 環境別 `.env` + dotenvx 方式（本プロジェクト採用）

`config.toml` は 1 個。環境差分は **`env()` 参照値のみ** を環境別 `.env` に分離。

### ディレクトリ

```
env/
├── backend/
│   ├── .env.local              # ローカル（平文 OK、gitignore）
│   ├── .env.stg                # Staging（dotenvx 暗号化、commit 可）
│   └── .env.prod               # Production（dotenvx 暗号化、commit 可）
└── .env.secrets                # Edge Functions 用 Secret

supabase/
├── config.toml                 # env() だらけ
└── ...
```

### 実行

```bash
# Staging
dotenvx run -f env/backend/.env.stg -- supabase config push

# Production
dotenvx run -f env/backend/.env.prod -- supabase config push
```

### Make + ENV の慣習（本プロジェクト）

```makefile
# deploy.sh 内
devenv tasks run -P staging deploy:supabase
devenv tasks run -P production deploy:supabase
```

### 本プロジェクトの `scripts/supabase/link.sh`

```bash
dotenvx run -f "env/backend/.env.${ENV}" -- \
  bash -c 'supabase link --project-ref $SUPABASE_PROJECT_REF'
```

`SUPABASE_PROJECT_REF` を環境別 `.env` に入れておくことで、1 コマンドで正しい環境にリンクされる。

---

## 戦略 A と B のハイブリッド（推奨）

両方の良いとこ取り。本プロジェクトに最適:

| 層 | 管理方法 | 例 |
|----|---------|-----|
| **静的な差分**（feature flag, rate limit, pool size） | `[remotes.<name>]` で宣言 | `rate_limit.email_sent = 10` |
| **環境ごとに違う動的値**（URL, Secret） | `env()` + 環境別 `.env` | `site_url = "env(SUPABASE_AUTH_SITE_URL)"` |

```toml
[auth]
site_url = "env(SUPABASE_AUTH_SITE_URL)"  # 環境ごと
jwt_expiry = 3600                           # 共通

[remotes.production.auth]
# site_url は env() で十分なので記述不要
jwt_expiry = 1800  # 本番だけ短縮

[remotes.production.auth.rate_limit]
email_sent = 10
```

---

## dotenvx 暗号化パターン

### 初期セットアップ

```bash
# dotenvx で暗号化された値をセット
# → .env.stg は暗号文（commit 可）、.env.keys は鍵（gitignore）
npx @dotenvx/dotenvx set \
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET "<plain-secret>" \
  -f env/backend/.env.stg

# 同じ値を本番向けにも
npx @dotenvx/dotenvx set \
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET "<plain-secret>" \
  -f env/backend/.env.prod
```

### `.env.keys` の扱い

| 環境 | 保管場所 |
|------|---------|
| ローカル開発 | `env/backend/.env.keys`（gitignore） |
| GitHub Actions | `secrets.DOTENVX_PRIVATE_KEY_STG` / `_PROD` |

```yaml
# CI で .env.keys を復元
- name: Restore dotenvx keys
  run: |
    cat <<EOF > env/backend/.env.keys
    DOTENVX_PRIVATE_KEY_STG=${{ secrets.DOTENVX_PRIVATE_KEY_STG }}
    DOTENVX_PRIVATE_KEY_PROD=${{ secrets.DOTENVX_PRIVATE_KEY_PROD }}
    EOF

- run: dotenvx run -f env/backend/.env.${ENV} -- supabase config push
```

---

## Supabase Branching との関係

Supabase の **Branching 機能**（GitHub 連携で PR ごとに DB を切る）を使う場合:

```toml
# supabase/.env.preview   ← preview branch 用 dotenvx 暗号
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET="encrypted:..."

# supabase/.env.production ← 本番 branch 用
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET="encrypted:..."

# supabase/.env.keys       ← 復号鍵（gitignore、Dashboard Secret に登録）
```

Branching Executor が `.env.keys` を使って自動復号する（Dashboard に登録済みの鍵を使う）。

**本プロジェクトは Branching を使わず `ENV=stg/prod` 手動運用** を採るならこの層は不要。

---

## 比較まとめ

| 戦略 | 利点 | 欠点 |
|------|------|------|
| **A. `[remotes.*]` のみ** | 1 ファイル可視性、静的差分に強い | 動的値（Secret）は別途 env() か encrypted: が必要 |
| **B. `.env` 環境別のみ** | dotenvx で暗号化された Secret を Git 管理できる | 静的差分の可視性が低い |
| **A + B ハイブリッド（推奨）** | 静的差分は `[remotes.*]`、動的値は env() | 学習コストがやや高い |

---

## 参照

- [Branching: Configuration（`[remotes.*]` 詳細）](https://supabase.com/docs/guides/deployment/branching/configuration)
- [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [dotenvx](https://dotenvx.com/)
