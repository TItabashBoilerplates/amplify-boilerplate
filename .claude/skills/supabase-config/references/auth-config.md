# `[auth]` 完全ガイド

`supabase config push` で反映される認証設定。**Secret は必ず `env()` 経由**。詳細キー一覧は [config-toml-reference.md](config-toml-reference.md) の `[auth]` を参照。

## 設計原則

1. **`site_url` / `additional_redirect_urls` を環境ごとに切替**（ハードコード禁止）
2. OAuth / SMTP / Hooks の `secret` はすべて `env()`
3. Rate limit は **本番だけ厳しく**（`[remotes.production.auth.rate_limit]`）
4. `enable_anonymous_sign_ins = true` にする場合は RLS での隔離を必ず設計
5. `enable_signup` を本番で `false` にする場合は招待制運用に切り替え

---

## 最小構成（ローカル用）

```toml
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["http://localhost:3000"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
minimum_password_length = 12
password_requirements = "letters_digits_symbols"  # 空文字で無制限

[auth.email]
enable_signup = true
enable_confirmations = false  # ローカルは無効化
double_confirm_changes = true

[auth.rate_limit]
email_sent = 2
sms_sent = 30
sign_in_sign_ups = 30
token_refresh = 150
```

---

## OAuth Provider

### GitHub

```toml
[auth.external.github]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
secret    = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
# redirect_uri = "https://<project-ref>.supabase.co/auth/v1/callback"  # 省略可
```

### Google（ローカルで動かす場合のみ `skip_nonce_check`）

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret    = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
skip_nonce_check = false  # ローカル One-Tap 検証を通すときだけ true
```

### Apple

```toml
[auth.external.apple]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID)"
secret    = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"
```

> **重要**: OAuth の Provider ごとの `redirect_uri` は Supabase 側で自動生成される。Provider Console（GitHub/Google Cloud）側に登録する URL は `https://<project-ref>.supabase.co/auth/v1/callback` だけ。

### `[remotes.*]` で環境別に ON/OFF

```toml
[remotes.staging.auth.external.google]
enabled = true

[remotes.production.auth.external.google]
enabled = true
# Secret は env(PRODUCTION_...) を環境別 .env から注入
```

---

## SMTP（本番メール送信）

```toml
[auth.email]
# SMTP を使う場合
enable_confirmations = true
max_frequency = "1m"

[auth.email.smtp]
enabled     = true
host        = "env(SUPABASE_AUTH_SMTP_HOST)"        # smtp.resend.com 等
port        = 587
user        = "env(SUPABASE_AUTH_SMTP_USER)"        # resend 等
pass        = "env(SUPABASE_AUTH_SMTP_PASS)"        # API Key
admin_email = "env(SUPABASE_AUTH_SMTP_ADMIN_EMAIL)" # no-reply@example.com
sender_name = "env(SUPABASE_AUTH_SMTP_SENDER_NAME)" # "Example App"
```

### メールテンプレートのカスタマイズ

```toml
[auth.email.template.invite]
subject = "You have been invited"
content_path = "./supabase/templates/invite.html"

[auth.email.template.confirmation]
subject = "Confirm your email"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Reset password"
content_path = "./supabase/templates/recovery.html"

[auth.email.template.magic_link]
subject = "Your magic link"
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.email_change]
subject = "Confirm email change"
content_path = "./supabase/templates/email_change.html"
```

HTML テンプレートは `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .Data }}` を展開可能。

---

## Auth Hooks（`send_email` / `send_sms` / `custom_access_token` 等）

HTTP Hook を Edge Functions で受ける場合:

```toml
[auth.hook.send_email]
enabled = true
uri     = "https://<ref>.supabase.co/functions/v1/auth-send-email"
secrets = "env(SUPABASE_AUTH_HOOK_SEND_EMAIL_SECRETS)"  # カンマ区切り

[auth.hook.send_sms]
enabled = true
uri     = "https://<ref>.supabase.co/functions/v1/auth-send-sms"
secrets = "env(SUPABASE_AUTH_HOOK_SEND_SMS_SECRETS)"

[auth.hook.custom_access_token]
enabled = true
uri     = "pg-functions://postgres/public/custom_access_token_hook"
# Postgres 関数を使う場合、secrets は不要

[auth.hook.mfa_verification_attempt]
enabled = true
uri     = "pg-functions://postgres/public/mfa_verification_attempt_hook"

[auth.hook.password_verification_attempt]
enabled = true
uri     = "pg-functions://postgres/public/password_verification_attempt_hook"
```

### ローカル開発時の `uri`

```toml
[auth.hook.send_email]
uri = "http://host.docker.internal:54321/functions/v1/auth-send-email"
```

### Hook 受け側（Edge Function）

```ts
// supabase/functions/auth-send-email/index.ts
import { verifyWebhook } from "https://deno.land/x/standardwebhooks/mod.ts"

Deno.serve(async (req) => {
  const payload = await req.text()
  const secrets = Deno.env.get("SEND_EMAIL_HOOK_SECRETS")!
    .split(",")

  // secrets からどれかで検証通ればOK
  const headers = Object.fromEntries(req.headers)
  for (const secret of secrets) {
    try {
      await verifyWebhook(payload, headers, secret.replace("v1,whsec_", ""))
      break
    } catch (_) {}
  }
  // メール送信
  return new Response("ok")
})
```

### config.toml 変更後は restart

```bash
supabase stop && supabase start
```

---

## MFA

```toml
[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true

[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false
otp_length = 6
max_frequency = "5s"
```

### 特定操作で AAL2 強制

DB 側 RLS で `(auth.jwt() ->> 'aal') = 'aal2'` を使う。`column-level-security.md`（RLS スキル）参照。

---

## Rate limit

```toml
[auth.rate_limit]
email_sent           = 2     # /時
sms_sent             = 30    # /時
anonymous_users      = 30    # /時 /IP
token_refresh        = 150   # /5分 /IP
sign_in_sign_ups     = 30    # /5分 /IP
token_verifications  = 30    # /5分
web3                 = 30    # /5分 /IP

# Staging は緩く
[remotes.staging.auth.rate_limit]
sign_in_sign_ups = 100

# Production は厳しめ
[remotes.production.auth.rate_limit]
email_sent = 10        # 専用 SMTP のクォータに合わせる
sign_in_sign_ups = 15  # Brute force 耐性
token_refresh = 300
```

### SMTP を入れないときの注意

デフォルトの無料 SMTP では **`email_sent = 2/時/プロジェクト全体`** と非常に厳しい。本番は必ず自前 SMTP（Resend / Postmark / SES）を用意し、`rate_limit.email_sent` を引き上げる。

---

## Third-Party Auth（Firebase / Auth0 / Clerk / Cognito）

既存 IdP を移行せず Supabase DB だけ使いたい場合:

```toml
[auth.third_party.firebase]
enabled = true
project_id = "env(FIREBASE_PROJECT_ID)"

[auth.third_party.auth0]
enabled = true
tenant = "env(AUTH0_TENANT)"
tenant_region = "env(AUTH0_TENANT_REGION)"

[auth.third_party.aws_cognito]
enabled = true
user_pool_id = "env(COGNITO_USER_POOL_ID)"
user_pool_region = "env(COGNITO_USER_POOL_REGION)"

[auth.third_party.clerk]
enabled = true
domain = "env(CLERK_DOMAIN)"
```

3rd party JWT を `auth.jwt()` で読めるようになる。RLS では `auth.jwt() ->> 'sub'` が IdP の user ID になる。

---

## Web3 (Solana)

```toml
[auth.web3.solana]
enabled = true
```

Sign in with Solana（SIWS）対応。

---

## OAuth Server（自身を IdP にする）

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = false  # 企業向けは false 固定
```

---

## 環境別ベストプラクティス

| 設定 | local | staging | production |
|------|-------|---------|-----------|
| `site_url` | `http://127.0.0.1:3000` | `https://staging.example.com` | `https://example.com` |
| `email.enable_confirmations` | false | true | true |
| `mfa.totp.enroll_enabled` | true | true | true |
| `rate_limit.email_sent` | 2 | 5 | 10+（SMTP 次第） |
| `enable_signup` | true | true | true or false（招待制なら false） |
| `enable_anonymous_sign_ins` | 用途次第 | 用途次第 | ほぼ false |
| `password_requirements` | - | - | `"letters_digits_symbols"` |

---

## 禁止パターン

```toml
# ❌ 平文 Secret
secret = "abc123xxxxx"

# ❌ ローカル URL を本番で使う
site_url = "http://localhost:3000"  # 本番 config push で崩壊

# ❌ enable_confirmations を本番で false
[auth.email]
enable_confirmations = false  # アカウント乗っ取り経路

# ❌ rate_limit をデフォルトのまま本番投入
# → Supabase 無料 SMTP の 2/時 で認証障害が頻発
```

---

## 参照

- [Auth: All about Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Auth: Configuration](https://supabase.com/docs/guides/auth)
- [Password Requirements](https://supabase.com/docs/guides/auth/password-security)
