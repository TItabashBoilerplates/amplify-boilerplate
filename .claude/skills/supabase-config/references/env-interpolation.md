# env() / encrypted: / Secrets の扱い

`config.toml` は **Git 管理対象**。Secret を直接書いてはいけない。Supabase CLI は 3 種類の参照方式を提供する。

## 参照方式の比較

| 方式 | 形式 | 使える場所 | Git | 備考 |
|------|------|-----------|-----|------|
| **`env(VAR)`** | `secret = "env(GITHUB_SECRET)"` | ほぼ全フィールド | 式のみコミット | `.env` または CI 環境変数から解決 |
| **`encrypted:`** | `secret = "encrypted:base64..."` | Auth / DB / Studio / Edge Runtime の指定フィールドのみ | 暗号化文字列をコミット可 | `dotenvx` + 秘密鍵が必要 |
| **平文** | `secret = "ghp_..."` | — | **禁止** | Leak 事故の元 |

---

## 1. `env()` 方式（推奨・本プロジェクト採用）

### 構文

```toml
[auth.external.github]
enabled = true
client_id = "env(GITHUB_CLIENT_ID)"
secret = "env(GITHUB_SECRET)"
```

### 解決順序

1. **プロセス環境変数**（CI ランナー / `dotenvx run` の注入）
2. **プロジェクトルートの `.env`**（CLI が自動検出）

### `.env` の配置

```
.
├── .env                    # ← CLI 自動検出。gitignore 必須
├── .env.example            # commit 対象（中身はダミー）
├── supabase/
│   └── config.toml
```

### `.gitignore` 必須

```gitignore
.env
.env.*
!.env.example
!.env.keys  # dotenvx の鍵は別途扱い
```

### CI での注入

```yaml
# GitHub Actions: env block で注入すれば config.toml の env() が解決される
jobs:
  deploy:
    env:
      GITHUB_CLIENT_ID: ${{ secrets.SUPABASE_GITHUB_CLIENT_ID }}
      GITHUB_SECRET: ${{ secrets.SUPABASE_GITHUB_SECRET }}
    steps:
      - run: supabase config push
```

### 本プロジェクトでの注入（dotenvx 経由）

```bash
# env/backend/.env.stg などを dotenvx run -- で注入
dotenvx run -f env/backend/.env.stg -- supabase config push

# または scripts/supabase/deploy-config.sh のように wrap
```

---

## 2. `encrypted:` 方式（dotenvx）

**対象フィールドが限定的**: Studio / Database / Auth（core, email/SMTP, captcha, webhooks, SMS provider, OAuth）/ Edge Runtime secrets のみ。それ以外で `encrypted:` を書くと **復号されない**。

### セットアップ

```bash
# 1. 暗号化用のキーペアを生成しつつ値をセット
npx @dotenvx/dotenvx set \
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET "<secret>" \
  -f supabase/.env.production

# → supabase/.env.keys に復号鍵（gitignore）
# → supabase/.env.production に暗号文（commit 可）
```

### 生成物

| ファイル | 用途 | Git |
|---------|------|-----|
| `supabase/.env.keys` | 全環境の復号鍵 | **gitignore** |
| `supabase/.env.production` | 本番向け暗号 Secret | commit OK |
| `supabase/.env.preview` | プレビューブランチ用 | commit OK |

### config.toml 側

**Option A - `encrypted:` 直埋め（対応フィールドのみ）:**

```toml
[auth.external.github]
secret = "encrypted:BCGl9I2iEp0wvU1bvhL3DYN+..."
```

**Option B - `env()` で参照（汎用・推奨）:**

```toml
[auth.external.github]
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
```

### CI 実行

```bash
# .env.keys は CI Secret として読ませる
npx dotenvx run -f supabase/.env.production -- npx supabase config push
```

### Branching（ブランチごとの Secret）

Supabase Branching を使う場合、`supabase/.env.keys` を `supabase secrets set --env-file supabase/.env.keys` で Platform 側に保存。ブランチ生成時に自動で復号される。

---

## 3. `supabase secrets set`（Edge Functions 用）

**これは `config.toml` の `env()` とは別系統**。Edge Functions の Runtime に注入される環境変数を管理する。

### ユースケース

| 設定対象 | どこに書く | 反映コマンド |
|---------|-----------|-------------|
| Auth / OAuth / SMTP / Hooks の secret | `config.toml` の `env()` | `supabase config push` |
| Function 内で `Deno.env.get('X')` で読む値 | Platform Secrets | `supabase secrets set` |

### コマンド

```bash
# 単一
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx --project-ref $REF

# env-file（複数）
supabase secrets set --env-file env/.env.secrets --project-ref $REF

# 確認
supabase secrets list --project-ref $REF

# 削除
supabase secrets unset STRIPE_SECRET_KEY --project-ref $REF
```

### 既定で利用可能な Secret（Edge Functions 内）

以下は Platform 側で **自動で入る**:

| 変数 | 用途 |
|------|------|
| `SUPABASE_URL` | プロジェクト URL |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_DB_URL` | 直接 Postgres 接続 URL |
| `SB_REGION` | リージョン |
| `SB_EXECUTION_ID` | 実行 ID |
| `DENO_DEPLOYMENT_ID` | — |

これらを `supabase secrets set` で上書きしない。

### 本プロジェクトでの注入

シークレットは **Doppler ネイティブ連携（Doppler→Supabase sync）** で Supabase secrets に自動
反映する（旧 `scripts/supabase/deploy-secrets.sh` / dotenvx は廃止）。`supabase secrets list` で
確認でき、Edge Functions / config.toml の `env()` から参照できる。設定手順は
`.claude/skills/doppler/references/cicd.md`、方針は `.claude/skills/doppler/SKILL.md`。

---

## よくある env() 対象フィールド一覧

本プロジェクトで典型的に使う参照先:

```toml
# OAuth
[auth.external.github]
client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
secret    = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"

[auth.external.google]
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret    = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"

# SMTP（Resend 等を使う場合）
[auth.email.smtp]
enabled   = true
host      = "env(SUPABASE_AUTH_SMTP_HOST)"
port      = 587
user      = "env(SUPABASE_AUTH_SMTP_USER)"
pass      = "env(SUPABASE_AUTH_SMTP_PASS)"
admin_email = "env(SUPABASE_AUTH_SMTP_ADMIN_EMAIL)"
sender_name = "env(SUPABASE_AUTH_SMTP_SENDER_NAME)"

# Auth Hook
[auth.hook.send_email]
enabled = true
uri     = "env(SUPABASE_AUTH_HOOK_SEND_EMAIL_URI)"
secrets = "env(SUPABASE_AUTH_HOOK_SEND_EMAIL_SECRETS)"

# SMS
[auth.sms.twilio]
enabled              = true
account_sid          = "env(SUPABASE_AUTH_SMS_TWILIO_ACCOUNT_SID)"
message_service_sid  = "env(SUPABASE_AUTH_SMS_TWILIO_MESSAGE_SERVICE_SID)"
auth_token           = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"

# Studio
[studio]
openai_api_key = "env(OPENAI_API_KEY)"

# site_url / redirect を環境ごとに切替
[auth]
site_url = "env(SUPABASE_AUTH_SITE_URL)"
```

---

## 優先順位まとめ

```
[CI 環境変数 / dotenvx run --] > [プロジェクトルート .env] > 未定義（エラー）
```

`env()` の値が未定義だと `supabase config push` / `supabase start` で validate エラー。**全環境で `.env.example` を整えて CI Secret と対応付け** るのが運用の肝。

---

## 禁止パターン

```toml
# ❌ 平文
secret = "ghp_xxx"

# ❌ 対応外フィールドに encrypted:
[auth]
site_url = "encrypted:..."   # site_url は encrypted: 非対応

# ❌ env() の中に式
secret = "env(GITHUB_${ENV}_SECRET)"  # 展開されない

# ❌ Functions 用の Secret を config.toml に書く
[functions.stripe-webhooks]
stripe_key = "env(STRIPE_SECRET)"  # config.toml の [functions.*] はこのキーを持たない
# → 正: supabase secrets set STRIPE_SECRET=... を別途実行
```

---

## 参照

- [Managing config and secrets](https://supabase.com/docs/guides/local-development/managing-config)
- [Branching: Configuration（encrypted 対応フィールド一覧）](https://supabase.com/docs/guides/deployment/branching/configuration)
- [Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [dotenvx](https://dotenvx.com/)
