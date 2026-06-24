# Drift 検知と検証

**Drift** = リモートの Supabase 設定と `config.toml` の乖離。Dashboard 手動変更、他のブランチからの `config push`、未反映の PR などで発生する。

## Drift が起きる典型シナリオ

| 原因 | 例 |
|------|----|
| Dashboard 手動変更 | 誰かが Auth → Providers → GitHub → Secret をコンソールで更新 |
| 他ブランチからの競合 push | `develop` と `feature/x` が別々に `config push` |
| Secret の未反映 | `config.toml` に `env()` 追加したが CI Secret に登録し忘れ |
| 失敗した `config push` | `db push` 失敗で config だけ残った |
| CLI バージョン差 | 古い CLI で push した値が新 CLI で validate 失敗 |

---

## 検知の基本戦略

### 1. PR で `git diff supabase/config.toml` を必ず目視

- PR 必須レビュー項目
- `[auth]` / `[functions.*]` / `[storage.buckets.*]` の変更は **特に注意**
- `env()` 新規導入なら GitHub Secret の追加も必須

### 2. 週次 Drift チェックワークフロー

`.github/workflows/drift-check.yml`:

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
      fail-fast: false
      matrix:
        env: [staging, production]
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v2
      - name: Link
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets[format('{0}_DB_PASSWORD', matrix.env)] }}
        run: |
          supabase link --project-ref "${{ secrets[format('{0}_PROJECT_ID', matrix.env)] }}"

      - name: DB schema drift
        run: |
          supabase db diff --linked --schema public --file /tmp/drift.sql || true
          if [ -s /tmp/drift.sql ]; then
            echo "::error::DB schema drift detected in ${{ matrix.env }}"
            cat /tmp/drift.sql
            exit 1
          fi

      - name: Config drift（dry-run 代替）
        run: |
          # config push の dry-run は現状無い。
          # 代わりに以下でチェック:
          # 1. Migration history list
          # 2. functions list
          echo "📋 Migration history:"
          supabase migration list
          echo "📋 Functions:"
          supabase functions list || true

      - name: Notify on failure
        if: failure()
        run: |
          echo "::warning::Drift in ${{ matrix.env }}. Investigate before next deploy."
```

### 3. Pre-deploy 確認（Production ワークフローに埋め込む）

```yaml
- name: Pre-deploy diff
  run: |
    supabase migration list
    echo ""
    echo "About to push config changes:"
    git show --stat HEAD -- supabase/config.toml
```

---

## 「`supabase config pull` が無い」問題への対処

現状（2026-04）、Supabase CLI に `config pull` 相当は存在しない。そのため Dashboard 変更を自動で検知する手段が限定的。

### ワークアラウンド 1: Postgres 経由で `auth.*` / `storage.*` 設定を SELECT

```sql
-- Staging/Prod に対して read-only で実行
SELECT * FROM auth.config;         -- 一部の auth 設定
SELECT * FROM storage.buckets;     -- Bucket 一覧
```

これを週次で snapshot し、前回と diff。

### ワークアラウンド 2: Supabase Management API

```bash
# GET /v1/projects/{ref}/config/auth で Auth 設定を取得可能
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"
```

| Endpoint | 用途 |
|---------|------|
| `GET /v1/projects/{ref}/config/auth` | Auth 設定 snapshot |
| `GET /v1/projects/{ref}/functions` | Functions 一覧 |
| `GET /v1/projects/{ref}/storage/buckets` | Bucket 一覧 |

取得値を `config.toml` と突き合わせて diff する script を CI に組む。

---

## 検証チェックリスト（本番 deploy 前）

Staging で push した後、本番に進む前:

- [ ] Staging Dashboard で手動変更された形跡が無い（直近 1 週間の audit log 確認）
- [ ] `git diff origin/main HEAD -- supabase/config.toml` が PR の意図と一致
- [ ] 新しい `env()` 参照がある場合、本番用 GitHub Secret を登録済み
- [ ] 新しい Bucket 追加時、RLS ポリシーも同時に migration に入っている
- [ ] 新しい OAuth Provider 追加時、Provider Console 側の Redirect URI も更新済み
- [ ] 新しい Auth Hook 追加時、受け側 Edge Function がデプロイ済み
- [ ] Rate limit 変更が本番トラフィックで問題ないか（特に `email_sent`）

---

## 緊急 Drift 解消手順

本番 Drift が発覚した場合:

```
1. 影響範囲を特定
   - Dashboard で該当設定を確認
   - 直近の audit log 確認（Dashboard → Project Settings → Logs）

2. Drift が意図的な変更か判断
   ├─ Yes（緊急対応で変更）→ 該当変更を config.toml に反映 → PR
   └─ No（意図しない変更）  → config push で config.toml の値に戻す

3. 再発防止
   - Dashboard 権限を絞る（Owner 以外は Read-Only）
   - Drift check を cron に追加
   - 手動変更ガイド: 全員で config.toml 経由に統一
```

---

## Dashboard の権限設計（ベストプラクティス）

| Role | 権限 |
|------|------|
| **Owner** | 全権（緊急対応用、1〜2 名のみ） |
| **Admin** | Read-Only + SQL Editor 実行可能 |
| **Developer** | Read-Only |

**Admin / Developer に config 変更権限を与えない** のが drift 防止の最終防衛線。

---

## 参照

- [Supabase Management API](https://supabase.com/docs/reference/api)
- [Discussion #34456: supabase config pull](https://github.com/orgs/supabase/discussions/34456)
- [Supabase Audit Logs](https://supabase.com/docs/guides/platform/logs)
