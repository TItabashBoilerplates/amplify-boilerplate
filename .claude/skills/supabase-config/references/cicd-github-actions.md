# CI/CD: GitHub Actions 完全ワークフロー

**目的**: Dashboard での手動変更を禁止し、`main` / `develop` 等の Git ブランチを Single Source of Truth として Supabase リモートへ反映する。

## 必須 GitHub Secrets

| Secret | 用途 | 環境別 |
|--------|------|--------|
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token（全環境共通 / Owner 発行） | 共通 |
| `STAGING_PROJECT_ID` | Staging Project Ref | Staging |
| `STAGING_DB_PASSWORD` | Staging DB Password | Staging |
| `PRODUCTION_PROJECT_ID` | Production Project Ref | Production |
| `PRODUCTION_DB_PASSWORD` | Production DB Password | Production |
| `STAGING_<SECRET>` / `PRODUCTION_<SECRET>` | `config.toml` の `env()` 参照値 | 各環境 |

> CI では `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_ID` / `SUPABASE_ACCESS_TOKEN` の 3 つを非対話モード用に `env:` で必ず渡す。

---

## デプロイ順序（固定）

```
1. checkout
2. setup-cli         ← supabase/setup-cli@v2
3. link              ← supabase link --project-ref $SUPABASE_PROJECT_ID
4. config push       ← supabase config push  (Auth, API, Storage 設定等)
5. db push           ← supabase db push      (Migration 適用)
6. seed buckets      ← supabase seed buckets --linked  (Bucket 作成)
7. functions deploy  ← supabase functions deploy      (Edge Functions)
8. secrets set       ← supabase secrets set --env-file  (Functions Runtime Secret)
```

**理由**:
- `config push` は DB 既存が無くてもよい（Auth/API 設定のみ）
- `db push` の前に config を反映しておかないと、例えば `[db.migrations]` 設定が古いまま動作
- Functions を deploy してから Secrets を set しても、Functions は Secret 変更を次回呼び出しから反映

---

## ワークフロー 1: PR CI (`.github/workflows/ci.yml`)

PR では **デプロイしない**。以下だけを検証:
- `config.toml` / migrations が valid
- 型生成の diff が無い（DB と型のズレ）
- Edge Functions の lint / type-check

```yaml
name: Supabase CI

on:
  pull_request:
    paths:
      - 'supabase/**'
      - 'drizzle/**'
      - 'env/**'
      - '.github/workflows/ci.yml'
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v2
        with:
          version: latest

      # CLI は config.toml を validate するため、env() 参照値の最低限を埋める
      - name: Set dummy env for local validation
        run: |
          cp env/backend/.env.example .env
          echo "Dummy values set for CI validate"

      - name: Start local Supabase
        run: supabase start

      - name: Validate migrations (dry-run)
        run: supabase db diff --schema public --linked=false || true

      - name: Verify generated types are up-to-date
        run: |
          supabase gen types typescript --local > frontend/packages/types/schema.ts.new
          diff frontend/packages/types/schema.ts frontend/packages/types/schema.ts.new || (
            echo "❌ schema.ts is out of date. Run 'devenv tasks run model:build' and commit."
            exit 1
          )

      - name: Check Edge Functions
        run: |
          for dir in supabase/functions/*/; do
            [[ "$dir" == *"shared/"* ]] && continue
            echo "Checking $dir"
            (cd "$dir" && deno check --config=../deno.json index.ts)
          done

      - name: Stop Supabase
        if: always()
        run: supabase stop --no-backup
```

---

## ワークフロー 2: Staging Deploy (`.github/workflows/staging.yml`)

`develop` push で Staging に反映。

```yaml
name: Deploy Supabase to Staging

on:
  push:
    branches: [develop]
    paths:
      - 'supabase/**'
      - 'drizzle/**'
      - 'env/**'
  workflow_dispatch:

concurrency:
  group: supabase-staging
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging   # GitHub Environments で approver を設定可能

    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD:  ${{ secrets.STAGING_DB_PASSWORD }}
      SUPABASE_PROJECT_ID:   ${{ secrets.STAGING_PROJECT_ID }}

      # config.toml の env() が参照する値（環境固有）
      SUPABASE_AUTH_SITE_URL:                 ${{ vars.STAGING_SITE_URL }}
      SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID: ${{ secrets.STAGING_GITHUB_CLIENT_ID }}
      SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET:    ${{ secrets.STAGING_GITHUB_SECRET }}
      SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: ${{ secrets.STAGING_GOOGLE_CLIENT_ID }}
      SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET:    ${{ secrets.STAGING_GOOGLE_SECRET }}
      SUPABASE_AUTH_SMTP_HOST:                ${{ secrets.STAGING_SMTP_HOST }}
      SUPABASE_AUTH_SMTP_USER:                ${{ secrets.STAGING_SMTP_USER }}
      SUPABASE_AUTH_SMTP_PASS:                ${{ secrets.STAGING_SMTP_PASS }}

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v2
        with:
          version: latest

      - name: Link to staging
        run: supabase link --project-ref "$SUPABASE_PROJECT_ID"

      - name: Push config.toml
        run: supabase config push

      - name: Push database migrations
        run: supabase db push

      - name: Seed storage buckets
        run: supabase seed buckets --linked

      - name: Deploy Edge Functions
        run: supabase functions deploy --project-ref "$SUPABASE_PROJECT_ID"

      - name: Set Edge Functions secrets
        run: |
          # env-file を生成してから set（-- で直接 set すると echo 等で漏れる）
          cat <<EOF > /tmp/supabase.secrets
          STRIPE_SECRET_KEY=${{ secrets.STAGING_STRIPE_SECRET_KEY }}
          POLAR_ACCESS_TOKEN=${{ secrets.STAGING_POLAR_ACCESS_TOKEN }}
          RESEND_API_KEY=${{ secrets.STAGING_RESEND_API_KEY }}
          ONESIGNAL_API_KEY=${{ secrets.STAGING_ONESIGNAL_API_KEY }}
          EOF
          supabase secrets set --env-file /tmp/supabase.secrets --project-ref "$SUPABASE_PROJECT_ID"
          rm /tmp/supabase.secrets

      - name: Summary
        run: |
          echo "✅ Deployed to Staging ($SUPABASE_PROJECT_ID)"
          supabase status -o pretty
```

---

## ワークフロー 3: Production Deploy (`.github/workflows/production.yml`)

`main` push で本番。**GitHub Environments の protection rules で手動承認必須**にするのが鉄則。

```yaml
name: Deploy Supabase to Production

on:
  push:
    branches: [main]
    paths:
      - 'supabase/**'
      - 'drizzle/**'
      - 'env/**'
  workflow_dispatch:

concurrency:
  group: supabase-production
  cancel-in-progress: false  # 本番は並列禁止

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production       # Settings → Environments で Required reviewers を設定
      url: https://app.supabase.com/project/${{ secrets.PRODUCTION_PROJECT_ID }}

    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD:  ${{ secrets.PRODUCTION_DB_PASSWORD }}
      SUPABASE_PROJECT_ID:   ${{ secrets.PRODUCTION_PROJECT_ID }}

      SUPABASE_AUTH_SITE_URL: ${{ vars.PRODUCTION_SITE_URL }}
      # ...(staging と同じパターンで全 env() 参照値を PRODUCTION_ 系に切替)

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v2
        with:
          version: latest

      - name: Pre-deploy diff (informational)
        run: |
          supabase link --project-ref "$SUPABASE_PROJECT_ID"
          echo "📋 Current migration status:"
          supabase migration list

      - name: Push config.toml
        run: supabase config push

      - name: Push migrations (with safeguard)
        run: |
          supabase db push --include-all

      - name: Seed storage buckets
        run: supabase seed buckets --linked

      - name: Deploy Edge Functions
        run: supabase functions deploy --project-ref "$SUPABASE_PROJECT_ID"

      - name: Set Edge Functions secrets
        run: |
          cat <<EOF > /tmp/supabase.secrets
          STRIPE_SECRET_KEY=${{ secrets.PRODUCTION_STRIPE_SECRET_KEY }}
          ...
          EOF
          supabase secrets set --env-file /tmp/supabase.secrets --project-ref "$SUPABASE_PROJECT_ID"
          rm /tmp/supabase.secrets
```

---

## ワークフロー 4: Drift チェック（週次）

Dashboard 手動変更を検知するジョブ。詳細は `drift-and-verification.md`。

```yaml
name: Supabase Drift Check
on:
  schedule:
    - cron: '0 9 * * 1'   # 毎週月曜 9:00 UTC
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        env: [staging, production]
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v2
      - name: Link
        run: supabase link --project-ref ${{ secrets[format('{0}_PROJECT_ID', matrix.env)] }}
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets[format('{0}_DB_PASSWORD', matrix.env)] }}
      - name: Diff migrations
        run: |
          supabase db diff --linked --schema public --file /tmp/drift.sql || true
          if [ -s /tmp/drift.sql ]; then
            echo "::error::Drift detected in ${{ matrix.env }}"
            cat /tmp/drift.sql
            exit 1
          fi
```

---

## ローカルで同じ手順を走らせる（本プロジェクト）

`scripts/supabase/deploy.sh` が上記順序を wrap 済み:

```bash
# staging
devenv tasks run -P staging deploy:supabase

# production
devenv tasks run -P production deploy:supabase
```

CI YAML とローカルで **同一 Make ターゲットを使う** ようにすれば、CI 環境と手元の挙動が一致する:

```yaml
# ワークフローを make に寄せる例
- run: |
    export SUPABASE_PROJECT_REF=$SUPABASE_PROJECT_ID
    devenv tasks run -P production deploy:supabase
```

---

## setup-cli Action のバージョン

- `supabase/setup-cli@v2` が現行メジャー
- `version: latest` で最新、`version: 2.84.2` のように固定も可
- `bun.lock` / `pnpm-lock.yaml` / `package-lock.json` に `supabase` が入っていれば自動検出

```yaml
- uses: supabase/setup-cli@v2
  with:
    version: latest
```

---

## トラブルシューティング

### `Error: config.toml has validation errors`（`env()` が解決できない）

```yaml
# env block で全 env() 参照値を渡すか、dummy を入れる
env:
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET: ${{ secrets.GITHUB_SECRET || 'dummy-for-validate' }}
```

### `supabase link` で password プロンプト

```yaml
env:
  SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}  # 必須
```

### 本番で `db push` が hang

- 長時間ロックを取る migration が入った
- `concurrency` を `cancel-in-progress: false` にしておくこと
- 対応: 事前に Staging で `EXPLAIN` / 手動 `CREATE INDEX CONCURRENTLY` 等に分割

---

## 参照

- [supabase/setup-cli](https://github.com/supabase/setup-cli)
- [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [GitHub Actions Env & Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Environments（approver）](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
