# `[functions.*]` / `[edge_runtime]` 完全ガイド

Edge Functions ごとの設定と Edge Runtime 全体の設定。

## 設計原則

1. **すべての Function に `[functions.<name>]` セクションを書く**（明示的に管理）
2. **Webhook 系は `verify_jwt = false`**（Stripe/Polar/OneSignal 等の署名検証で十分）
3. Function 用 Secret は `supabase secrets set` で別管理（`config.toml` ではない）
4. デプロイから除外したい Function は `enabled = false`
5. `import_map` を使うなら **全 Function 共通の `deno.json`** を使うか、個別に指定

---

## `[functions.<name>]` キー一覧

```toml
[functions.my-function]
enabled = true                # false = デプロイ対象外 & ローカルで serve しない
verify_jwt = true             # true = Authorization header 必須
import_map = "./functions/my-function/import_map.json"  # 個別 import map
entrypoint = "./functions/my-function/index.ts"         # エントリポイント上書き
static_files = ["./functions/my-function/assets/**"]    # 同梱静的ファイル
```

| キー | デフォルト | 説明 |
|------|-----------|------|
| `enabled` | `true` | `false` にすると `supabase functions deploy` から除外され、ローカルでも serve されない |
| `verify_jwt` | `true` | `false` で未認証リクエスト受け付け |
| `import_map` | — | `./functions/<name>/import_map.json` などパス指定 |
| `entrypoint` | `./functions/<name>/index.ts` | `.ts` / `.js` / `.tsx` / `.jsx` / `.mjs` |
| `static_files` | — | glob 可 |

---

## Webhook 系（`verify_jwt = false`）

本プロジェクトの `supabase/functions/` 配下の実装に対応:

```toml
[functions.polar-webhooks]
enabled = true
verify_jwt = false  # Polar 側署名検証で十分

[functions.onesignal-webhooks]
enabled = true
verify_jwt = false

[functions.stripe-webhooks]
enabled = true
verify_jwt = false

[functions.stripe-checkout]
enabled = true
verify_jwt = true   # ユーザー認証あり

[functions.stripe-products]
enabled = true
verify_jwt = true

[functions.watermark]
enabled = true
verify_jwt = true

[functions.helloworld]
enabled = true
verify_jwt = true

[functions.onesignal-send]
enabled = true
verify_jwt = true
```

### 本プロジェクトの現状

`Makefile` で `--no-verify-jwt` を個別指定しているが、`config.toml` に移すと一元管理できる:

```makefile
# 旧（分散管理）
supabase functions deploy stripe-webhooks --no-verify-jwt --project-ref $$SUPABASE_PROJECT_REF

# 新（config.toml に集約）
# [functions.stripe-webhooks] verify_jwt = false
supabase functions deploy  # 全 function を一括デプロイ、設定は config.toml
```

---

## `[edge_runtime]`

```toml
[edge_runtime]
enabled = true
policy = "per_worker"        # "per_worker"（本番）/ "oneshot"（開発 hot reload）
inspector_port = 8083        # Chrome DevTools
deno_version = 2
```

| キー | 説明 |
|------|------|
| `policy = "per_worker"` | プロダクション用。Function インスタンスを再利用 |
| `policy = "oneshot"` | ローカル開発用。毎リクエスト新プロセス。hot reload 可 |
| `inspector_port` | `--inspect` で接続する DevTools ポート |
| `deno_version` | `2` が現行（2025 以降） |

### 本番推奨

```toml
[edge_runtime]
enabled = true
policy = "per_worker"
deno_version = 2

# ローカル用上書き
# （supabase config push しない限り反映されないが、ローカルは policy=oneshot 推奨）
```

`supabase functions serve` はローカルで `policy = "oneshot"` 相当の挙動を自動で選ぶ。

---

## Function Secrets（Runtime 環境変数）

**`config.toml` の `env()` とは別系統**。Edge Function の Deno ランタイムに渡す値は `supabase secrets` で管理する。

```bash
# 単一
supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref $REF

# env-file
supabase secrets set --env-file env/.env.secrets --project-ref $REF

# リスト
supabase secrets list --project-ref $REF

# 削除
supabase secrets unset STRIPE_SECRET_KEY --project-ref $REF
```

### Function 内で参照

```ts
// supabase/functions/stripe-webhooks/index.ts
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")
if (!stripeSecret) throw new Error("STRIPE_SECRET_KEY not set")
```

### 既定で利用可能な Secret

Platform（本番）側:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SB_REGION` / `SB_EXECUTION_ID` / `DENO_DEPLOYMENT_ID`

これらを `supabase secrets set` で上書きしない。

### ローカル開発

`supabase/functions/.env` を作れば自動で読まれる（gitignore 必須）:

```
# supabase/functions/.env
STRIPE_SECRET_KEY=sk_test_xxx
```

または `--env-file` オプションで任意のファイル指定:

```bash
supabase functions serve --env-file .env.local
```

---

## import_map / deno.json

### 全 Function 共通（推奨）

本プロジェクトは既に `supabase/functions/deno.json` を持っている。個別 `import_map` を書く必要は基本的にない。

```json
// supabase/functions/deno.json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.58.0",
    "stripe": "https://esm.sh/stripe@18.0.0",
    "zod": "https://deno.land/x/zod@v3.22.0/mod.ts"
  }
}
```

### Function 個別の import_map

```toml
[functions.my-function]
import_map = "./functions/my-function/import_map.json"
```

```json
// supabase/functions/my-function/import_map.json
{
  "imports": {
    "openai": "npm:openai@4.0.0"
  }
}
```

共通 `deno.json` と個別 `import_map` は **併用不可**。個別指定すると共通が効かなくなる。

---

## デプロイ

### 一括

```bash
supabase functions deploy --project-ref $REF
```

`[functions.<name>].enabled = false` の Function は自動スキップ。

### 個別

```bash
supabase functions deploy polar-webhooks --project-ref $REF
```

`--no-verify-jwt` フラグは **`config.toml` の `verify_jwt = false` と重複**。どちらか一方に寄せる（`config.toml` 推奨）。

### 注意: `functions deploy` は Secrets を操作しない

デプロイ後に別途 `supabase secrets set` が必要。

---

## 本プロジェクトでの推奨構成

```toml
[edge_runtime]
enabled = true
policy = "per_worker"
deno_version = 2

# Webhook 系（JWT 検証オフ）
[functions.polar-webhooks]
verify_jwt = false

[functions.onesignal-webhooks]
verify_jwt = false

[functions.stripe-webhooks]
verify_jwt = false

# 認証必須系
[functions.stripe-checkout]
verify_jwt = true

[functions.stripe-products]
verify_jwt = true

[functions.onesignal-send]
verify_jwt = true

[functions.watermark]
verify_jwt = true

# テスト用（本番デプロイから除外）
[functions.helloworld]
enabled = false
```

これで Makefile の個別 `--no-verify-jwt` 指定は削除可能になる。

---

## 禁止パターン

```toml
# ❌ verify_jwt を書かない（デフォルト true だが、意図を明示すべき）
[functions.stripe-webhooks]
# verify_jwt = ???

# ❌ Function Secret を config.toml に書く
[functions.stripe-webhooks]
stripe_secret = "env(STRIPE_SECRET_KEY)"  # 存在しないキー、効かない

# ❌ 認証必須 Function で verify_jwt = false
[functions.user-profile-update]
verify_jwt = false  # anon でも呼べる = セキュリティ事故
```

---

## 参照

- [Edge Functions: Function Configuration](https://supabase.com/docs/guides/functions/function-configuration)
- [Edge Functions: Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Edge Functions: Deploy](https://supabase.com/docs/guides/functions/deploy)
- [Import Maps](https://supabase.com/docs/guides/functions/import-maps)
