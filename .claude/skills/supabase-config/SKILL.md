---
name: supabase-config
description: Supabase Config as Code（`supabase/config.toml`）をプロダクション品質で扱うスキル。`supabase config push` による Auth / API / Storage / Functions / Realtime 設定の Git 管理、`env()` / `encrypted:` による Secrets 分離、`[remotes.*]` によるマルチ環境、CI/CD 上の `link → config push → db push → seed buckets → functions deploy → secrets set` パイプライン、Drift 検知、CLI の config 検証エラー回避まで、公式ドキュメントに基づく完全ガイドをトピック別リファレンスで提供。
---

# Supabase Config as Code スキル

**前提: Supabase の設定（Auth, API, Storage, Functions, Realtime, SMTP, OAuth, Hooks）は Dashboard で手動変更しない。すべて `supabase/config.toml` に集約し、Git で管理し、CI から `supabase config push` で反映する。**

Dashboard 手動変更は **レビュー不能・再現不能・Drift の温床** であり、CI/CD の根幹を壊す。このスキルは Supabase CLI v2 系公式ドキュメント + 公式テンプレート + 本プロジェクトの `scripts/supabase/` 実装に基づく完全ガイドを、トピック別の `references/` に分割して提供する。

---

## いつ使うか

- 新規に `supabase/config.toml` を設計する
- Auth / OAuth / SMTP / Hooks / MFA を Git 管理下に移す
- Storage Bucket を宣言的に管理する
- CI/CD で Supabase リモートプロジェクトへ設定を反映する（`devenv tasks run -P <env> deploy:supabase`）
- Staging / Production の設定差分を `[remotes.*]` で管理する
- リモート設定と `config.toml` の drift を検知する
- GitHub Actions で「CLI が config.toml を validate して落ちる」問題に対処する

関連スキル:
- `supabase/` — Supabase クライアント・SSR 全般
- `drizzle/` — DB スキーマ（`config.toml` ではなく migrations で管理）
- `rls/` — RLS ポリシー（DB 層、`config.toml` 対象外）
- `debugging/` — devenv 2.0 native process manager 経由のローカルデバッグ

---

## Top 原則（これだけは必ず守る）

| # | 原則 | 理由 |
|---|------|------|
| 1 | **Dashboard で設定を手動変更しない** | Drift と「誰が何をいつ変えたか不明」状態を生む |
| 2 | **Secrets は `env()` か `encrypted:` で分離** | `config.toml` は Git 管理、秘密情報は別ファイル |
| 3 | **CI は `link → config push → db push → functions deploy → secrets set` の順** | 順序依存がある（Secrets は Functions より後でも可） |
| 4 | **マルチ環境は `[remotes.{project_id}]` で宣言**、または環境別 `config.toml` | 1 ファイルで staging/prod 差分を管理可能 |
| 5 | **CI のために `config.toml` の validate が通る状態を維持** | CLI は常に `config.toml` を読み込んで validate する |
| 6 | **`supabase secrets set --env-file` は `config push` とは別系統** | Functions 用 Secret と `config.toml` の env() 参照先は別物 |
| 7 | **`config.toml` 変更時は必ず `supabase stop && supabase start`** | CLI は起動時にのみ config を反映する |
| 8 | **`config push` は Secrets も上書きする可能性がある → dotenvx で暗号化管理** | 平文 Secret を Git に入れない |

---

## リファレンス構成

セキュリティ・CI/CD・デプロイ別で分類。すべて `references/` 配下。

### 📘 Core Reference（基本・設定値）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [config-toml-reference.md](references/config-toml-reference.md) | `config.toml` の全セクション・キー・デフォルト値（`[project_id]` / `[api]` / `[db]` / `[realtime]` / `[studio]` / `[inbucket]` / `[storage]` / `[auth]` / `[edge_runtime]` / `[analytics]` / `[experimental]` / `[functions.*]`） | **CRITICAL** |
| [env-interpolation.md](references/env-interpolation.md) | `env(VAR)` 構文、`encrypted:` 構文、`.env` 検出、CI での注入、`supabase secrets` との違いと優先順位 | **CRITICAL** |

### 🔐 Service-specific Config（サービス別設定）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [auth-config.md](references/auth-config.md) | `[auth]` 全体・`[auth.email]` / `[auth.sms]` / `[auth.mfa]` / `[auth.external.*]` / `[auth.hook.*]` / `[auth.rate_limit]` / `[auth.third_party.*]` / `[auth.web3.*]` / `[auth.oauth_server]` | **CRITICAL** |
| [storage-config.md](references/storage-config.md) | `[storage]` / `[storage.buckets.*]` / `[storage.image_transformation]` / `[storage.s3_protocol]` / `[storage.analytics]` / `[storage.vector]`、`supabase seed buckets --linked` | HIGH |
| [functions-config.md](references/functions-config.md) | `[functions.*]`（`enabled` / `verify_jwt` / `import_map` / `entrypoint` / `static_files`）、`[edge_runtime]`、`supabase functions deploy` との関係 | HIGH |
| [realtime-db-config.md](references/realtime-db-config.md) | `[realtime]` / `[db]` / `[db.pooler]` / `[db.migrations]` / `[db.seed]` / `[db.network_restrictions]` | MEDIUM |

### 🚀 CI/CD & Deployment（最重要）

| リファレンス | 内容 | 優先度 |
|-------------|------|--------|
| [cicd-github-actions.md](references/cicd-github-actions.md) | GitHub Actions 完全ワークフロー（staging / production）、`supabase/setup-cli@v2`、必須環境変数（`SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_ID`）、デプロイ順序、並列化、PR drift チェック | **CRITICAL** |
| [multi-environment.md](references/multi-environment.md) | `[remotes.{name}]` / `[remotes.{name}.*]` による環境差分、dotenvx による暗号化 Secrets、`.env.preview` / `.env.production` / `.env.keys`、本プロジェクトの `ENV={local,stg,prod}` 戦略 | **CRITICAL** |
| [drift-and-verification.md](references/drift-and-verification.md) | Drift 検知（Dashboard ↔ `config.toml` 差分）、`config push --dry-run` が無いための工夫、PR で差分レビュー、diff ベースの監視 | HIGH |
| [common-gotchas.md](references/common-gotchas.md) | CLI の `config.toml` validate 問題（`db push` だけでも config が要る）、`supabase start` しないと反映されない、`config push` が Secrets を意図せず上書きするケース、`--project-ref` 必須の場面、Inbucket の謎ポート衝突 | **CRITICAL** |

---

## マスターチェックリスト

Supabase 設定をレビューする際は以下を順に確認。該当リファレンスを読んで判断:

### 設計
- [ ] **Dashboard での手動変更を禁止** とチーム合意 → `cicd-github-actions.md`
- [ ] `supabase/config.toml` が Git 管理下にあり、**PR レビュー必須** → `cicd-github-actions.md`
- [ ] Secrets は **`env()` か `encrypted:`** のいずれかに統一（平文禁止） → `env-interpolation.md`
- [ ] `.env` / `.env.*` は `.gitignore` 済み、`.env.example` のみ commit → `env-interpolation.md`
- [ ] マルチ環境は `[remotes.{project_id}]` か環境別 config.toml のどちらか一方に統一 → `multi-environment.md`

### Auth
- [ ] `site_url` / `additional_redirect_urls` は環境ごとに正しく設定 → `auth-config.md`
- [ ] OAuth Provider の `secret` は **`env()` 経由** で注入 → `auth-config.md`
- [ ] `[auth.hook.*]` の `secrets` は **`env()` 経由** で注入 → `auth-config.md`
- [ ] SMTP 設定（`[auth.email.smtp]`）の `pass` は **`env()` 経由** → `auth-config.md`
- [ ] `[auth.rate_limit]` を本番環境向けに調整（Email/SMS/signup/token_refresh） → `auth-config.md`
- [ ] `[auth.mfa]` の `totp.enroll_enabled` / `verify_enabled` を要件に合わせる → `auth-config.md`
- [ ] `[auth.third_party.*]`（Firebase / Auth0 / Clerk / Cognito）を使う場合は `enabled = true` + ID 設定 → `auth-config.md`

### Storage
- [ ] `[storage.buckets.*]` で **宣言的に** Bucket を管理 → `storage-config.md`
- [ ] デフォルトは **Private Bucket**（`public = false`）→ `storage-config.md`
- [ ] `file_size_limit` / `allowed_mime_types` で制限を明記 → `storage-config.md`
- [ ] CI で `supabase seed buckets --linked` を実行 → `storage-config.md` + `cicd-github-actions.md`

### Functions
- [ ] 各 Function に `[functions.{name}]` が存在し、`enabled` / `verify_jwt` / `import_map` / `entrypoint` を明示 → `functions-config.md`
- [ ] Webhook 系（Stripe/Polar/OneSignal など）は **`verify_jwt = false`** → `functions-config.md`
- [ ] Function の Secret は `supabase secrets set --env-file` で注入（`config.toml` ではなく Edge Runtime の env） → `env-interpolation.md`
- [ ] デプロイから除外したい Function は `[functions.{name}] enabled = false` → `functions-config.md`

### Realtime / DB
- [ ] `[realtime] enabled = true`、必要なら `max_header_length` を調整 → `realtime-db-config.md`
- [ ] `[db.pooler]` は Staging/Prod で `enabled = true`、`pool_mode` を用途に合わせる → `realtime-db-config.md`
- [ ] `[db.migrations] schema_paths` が Drizzle 生成物をカバー → `realtime-db-config.md`
- [ ] `[db.network_restrictions]` を本番で有効化（CIDR allowlist） → `realtime-db-config.md`

### CI/CD
- [ ] GitHub Secrets に `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD_{ENV}` / `SUPABASE_PROJECT_ID_{ENV}` を登録 → `cicd-github-actions.md`
- [ ] `supabase/setup-cli@v2` で CLI をインストール → `cicd-github-actions.md`
- [ ] デプロイ順序: **link → config push → db push → seed buckets → functions deploy → secrets set** → `cicd-github-actions.md`
- [ ] PR（main 非マージ）では `db push --dry-run` + 型生成 diff チェックのみ → `cicd-github-actions.md`
- [ ] `main` ブランチ push で **Production deploy**、`develop` 等で **Staging deploy** → `cicd-github-actions.md`
- [ ] ローカルで `devenv tasks run -P staging deploy:supabase` / `devenv tasks run -P production deploy:supabase` が動くことを確認 → `cicd-github-actions.md`

### Drift
- [ ] Dashboard で変更されていないか定期チェック（週次 or cron） → `drift-and-verification.md`
- [ ] `config push` 前に diff を目視レビュー（`git diff supabase/config.toml`） → `drift-and-verification.md`
- [ ] Production への適用は **手動承認 Step** を挟む → `cicd-github-actions.md`

### トラブルシューティング
- [ ] CI で `config.toml` validate エラーが出たら → `common-gotchas.md`
- [ ] `supabase start` 後に設定が反映されない → `common-gotchas.md`
- [ ] `config push` で意図しない値が上書きされた → `common-gotchas.md`

---

## 禁止パターン（集約）

```toml
# ❌ Secret を平文で config.toml に書く
[auth.external.github]
secret = "ghp_xxxxxxxxxxxxxxxxxxxx"

# ✅ env() で外部化
[auth.external.github]
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"

# ❌ site_url を本番 URL でハードコード（複数環境で使えない）
[auth]
site_url = "https://myapp.com"

# ✅ env() で環境ごとに注入
[auth]
site_url = "env(SUPABASE_AUTH_SITE_URL)"

# ❌ Webhook に verify_jwt を付けたまま
[functions.stripe-webhooks]
verify_jwt = true  # Stripe の署名検証で十分。JWT 検証は邪魔になる

# ✅ Webhook は verify_jwt オフ
[functions.stripe-webhooks]
verify_jwt = false
```

```bash
# ❌ Dashboard で手動変更（drift 発生）
# Supabase Dashboard → Auth → Providers → GitHub → secret 変更 ❌

# ❌ CI から supabase config push をスキップ
supabase db push  # config 反映が抜ける ❌

# ✅ 正: CI/CD で必ず config push
supabase link --project-ref $SUPABASE_PROJECT_ID
supabase config push
supabase db push
supabase functions deploy
```

```yaml
# ❌ 複数環境で同じ PROJECT_ID を使う（Staging を消し飛ばす）
env:
  SUPABASE_PROJECT_ID: ${{ secrets.PROJECT_ID }}  # どの環境？

# ✅ 環境別に分ける
env:
  SUPABASE_PROJECT_ID: ${{ secrets.STAGING_PROJECT_ID }}
```

---

## 本プロジェクトの実装との対応

本プロジェクトは `scripts/supabase/` に CI/CD を分離済み:

| 操作 | Make コマンド | Script | 使う CLI コマンド |
|-----|---------------|--------|------------------|
| 全体デプロイ | `devenv tasks run -P staging deploy:supabase` | `deploy.sh` | (順次呼び出し) |
| リンク | `devenv tasks run -P <env> deploy:link` | `link.sh` | `supabase link --project-ref` |
| Config 反映 | `devenv tasks run -P <env> deploy:config` | `deploy-config.sh` | `supabase config push` |
| Bucket 同期 | `devenv tasks run -P <env> deploy:buckets` | `deploy-buckets.sh` | `supabase seed buckets --linked` |
| Function デプロイ | `devenv tasks run -P <env> deploy:functions` | `deploy-functions.sh` | `supabase functions deploy --project-ref` |
| Secrets 注入 | （Doppler ネイティブ連携で自動 sync） | — | Doppler → Supabase Integration |

シークレットは **Doppler ネイティブ連携（Doppler→Supabase sync）** で供給する（旧 `deploy-secrets.sh` /
dotenvx は廃止）。設定手順は `.claude/skills/doppler/references/cicd.md`。非機密の env は
`env/backend/.env.<ENV>`（ファイル）。詳細は `multi-environment.md`。

---

## 新規セットアップ時のワークフロー

```
1. supabase init で雛形生成（既存なら skip）
   └─ .gitignore に .env / .env.* を追加

2. config.toml を段階的に埋める
   ├─ [project_id] / [api] / [db] / [realtime] / [studio]  → 基本
   ├─ [auth] / [auth.email] / [auth.external.*]           → 認証（env() で Secret 分離）
   ├─ [storage] / [storage.buckets.*]                     → Bucket 宣言
   ├─ [functions.*]                                       → Function ごとの verify_jwt / import_map
   └─ [remotes.{staging_ref}] / [remotes.{prod_ref}]      → マルチ環境差分

3. env/backend/.env.{local,stg,prod} に env() 参照値を置く
   └─ .env.secrets は dotenvx で暗号化

4. ローカルで supabase start → 挙動確認

5. Staging に手動デプロイ（devenv tasks run -P staging deploy:supabase）
   └─ 本番前に全設定を Staging で検証

6. GitHub Actions を配線
   ├─ ci.yml: PR で db push --dry-run + 型 diff
   ├─ staging.yml: develop push で stg デプロイ
   └─ production.yml: main push で本番デプロイ（手動承認）

7. Dashboard を Read-Only 運用に（チーム合意 + 監査）
```

---

## 公式ドキュメント

### 必読
- **[Supabase CLI config reference](https://supabase.com/docs/guides/cli/config)** — `config.toml` の全キー
- **[Managing config and secrets](https://supabase.com/docs/guides/local-development/managing-config)** — `env()` と Secrets 管理
- **[Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)** — Staging/Prod ワークフロー
- **[Branching: Configuration](https://supabase.com/docs/guides/deployment/branching/configuration)** — `[remotes.*]` とブランチごとの設定

### CLI
- [supabase config push](https://supabase.com/docs/reference/cli/supabase-config-push)
- [supabase link](https://supabase.com/docs/reference/cli/supabase-link)
- [supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [supabase functions deploy](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
- [supabase secrets set](https://supabase.com/docs/reference/cli/supabase-secrets-set)
- [supabase seed buckets](https://supabase.com/docs/reference/cli/supabase-seed-buckets)

### GitHub Actions
- [supabase/setup-cli](https://github.com/supabase/setup-cli) — Action で CLI をセットアップ
- [GitHub Actions for Functions](https://supabase.com/docs/guides/functions/examples/github-actions) — 公式サンプル

### テンプレート（ソース）
- [config.toml template (supabase/cli develop)](https://github.com/supabase/cli/blob/develop/pkg/config/templates/config.toml) — 全デフォルトが読める

### 関連 Issue / Discussion
- [Handling config.toml in GitHub Actions（#33604）](https://github.com/orgs/supabase/discussions/33604) — CI 上の validate 問題
- [Add supabase config pull command（#34456）](https://github.com/orgs/supabase/discussions/34456) — 現状 `pull` 相当が無い件

---

## 強制事項

このスキルの内容は **交渉の余地なし**。

- **Dashboard での手動変更を許可しない**。すべて `config.toml` → PR → CI。
- **Secret を平文で `config.toml` に書かない**。`env()` か `encrypted:`。
- **CI パイプラインは必ず `link → config push → db push → ...` の順**。飛ばすと drift する。
- 判断に迷う場合は勝手に決定せず、**必ずユーザーに判断をあおぐ**。
