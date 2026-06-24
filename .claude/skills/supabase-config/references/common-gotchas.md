# よくあるハマりどころ

`supabase/config.toml` 運用で実際に踏む落とし穴。

## 1. CI で「`config.toml` has validation errors」

### 症状

```
Error: invalid config.toml: env variable GITHUB_SECRET not set
```

### 原因

CLI は **全コマンド実行前に `config.toml` 全体を validate** する。`db push` / `functions deploy` など、config.toml を直接使わないコマンドでも同じエラーで落ちる。

### 対処（優先順）

**A. env() 参照値をすべて CI Secret で埋める（推奨）**

```yaml
env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  # config.toml で env() している全キーを網羅
  GITHUB_SECRET:                           ${{ secrets.GITHUB_SECRET }}
  SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID: ${{ secrets.STAGING_GITHUB_CLIENT_ID }}
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET:    ${{ secrets.STAGING_GITHUB_SECRET }}
  # ...
```

**B. CI 専用の dummy を `|| 'dummy'` で埋める**

```yaml
env:
  GITHUB_SECRET: ${{ secrets.GITHUB_SECRET || 'dummy-for-validate' }}
```

> ⚠️ `config push` を実行する job では **dummy 禁止**。dummy が本番に反映されてしまう。Validate だけ必要な job 限定。

**C. config.toml を stub に差し替える（最終手段）**

```yaml
- name: Stub config for db-only commands
  run: |
    cat <<EOF > supabase/config.toml
    project_id = "stub"
    [api]
    enabled = true
    EOF
- run: supabase db push
```

本来の config を上書きするので、`config push` と併用できない。

---

## 2. `supabase start` 後に変更が反映されない

### 症状

`config.toml` を編集したのに `http://localhost:3000` の挙動が変わらない。

### 原因

CLI は **起動時にのみ config を読む**。編集後は再起動が必須。

### 対処

```bash
supabase stop
supabase start

# もしくは
supabase restart  # CLI 1.x 以降
```

> Hot reload 対象は **Edge Functions のソースコードのみ**。config.toml は対象外。

---

## 3. `config push` が想定外の値を上書きする

### 症状

Dashboard で急いで変更した設定が、`config push` 後に元に戻る。

### 原因

`config.toml` が Single Source of Truth。Dashboard の変更は **`config push` で上書きされる**。

### 対処

1. **Dashboard 変更は原則禁止**（`drift-and-verification.md`）
2. 緊急で Dashboard 変更した場合は **即 config.toml に反映 → PR**
3. `config push` 前に常に `git diff supabase/config.toml` を確認

---

## 4. `env()` の値が展開されない

### 症状

```toml
secret = "env(GITHUB_SECRET)"
```
が文字列 `"env(GITHUB_SECRET)"` のまま Supabase に保存される。

### 考えられる原因

1. `.env` がプロジェクトルートに無い
2. GitHub Actions の `env:` で定義していない
3. `env()` 内に **スペースや式が入っている**（`env( GITHUB_SECRET )` や `env(GITHUB_${ENV}_SECRET)`）
4. dotenvx 暗号化 `.env` を `dotenvx run --` 無しで直接 CLI 実行した

### 対処

```toml
# ✅ 正
secret = "env(GITHUB_SECRET)"

# ❌ スペース
secret = "env( GITHUB_SECRET )"

# ❌ 式
secret = "env(GITHUB_${ENV}_SECRET)"
```

```bash
# dotenvx 暗号化 .env を使う場合は必ず dotenvx run 経由
dotenvx run -f env/backend/.env.stg -- supabase config push
```

---

## 5. `--project-ref` 指定を忘れて別プロジェクトに push

### 症状

Staging に push したつもりが Production に反映されていた / 逆。

### 原因

`supabase link` が直前の link 状態を記憶する（`supabase/.temp/` 配下）。別プロジェクトで作業した後、link し直さずに `config push` を打つと **前回の link 先に push される**。

### 対処

**CI では毎回 `link --project-ref $REF` を実行**（キャッシュ依存禁止）:

```yaml
- run: supabase link --project-ref "$SUPABASE_PROJECT_ID"
- run: supabase config push
```

ローカルでも、本プロジェクトの `scripts/supabase/deploy.sh` は毎回 link から実行する設計になっている。

---

## 6. Port 衝突（`Error: port 54321 is already in use`）

### 原因

他の Supabase プロジェクトが同じポートで動いている。

### 対処

```bash
# 状況確認
lsof -i :54321
docker ps | grep supabase

# 全プロジェクト停止
supabase stop --all
```

複数プロジェクトを同時に動かすなら `config.toml` でポートを変える:

```toml
[api]
port = 54331

[db]
port = 54332
shadow_port = 54330

[studio]
port = 54333

[inbucket]
port = 54334
```

---

## 7. `supabase db push` でマイグレーションがロックで止まる

### 原因

- 大きなテーブルに `ADD COLUMN NOT NULL DEFAULT ...`
- 参照中テーブルに `ALTER COLUMN`
- 別のトランザクション（オートバキューム等）との競合

### 対処

1. `lock_timeout` を先に設定
   ```sql
   SET lock_timeout = '5s';
   ALTER TABLE ... ;
   ```
2. Migration を分割（`CREATE INDEX CONCURRENTLY` 等）
3. 事前に Staging で `EXPLAIN` で影響を確認

詳細は `.claude/skills/rls/references/migration-safety.md`。

---

## 8. Edge Functions の Secret が反映されない

### 原因

- `supabase secrets set` を `--project-ref` 指定なしで実行し、リンク先プロジェクトに入れたが、想定と違う環境
- `config.toml` の `env()` に書いたつもりが、Function 内から読めない（`env()` は `config.toml` 内の参照用で、Function Runtime には渡らない）

### 対処

```bash
# ✅ Function Runtime に渡す Secret は supabase secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx --project-ref $REF

# 確認
supabase secrets list --project-ref $REF
```

Function 側:

```ts
const key = Deno.env.get("STRIPE_SECRET_KEY")  // ← supabase secrets で入れた値
```

---

## 9. `[remotes.<name>]` が効かない

### 原因

- `project_id` の記述ミス（Dashboard の Project Ref と一致していない）
- `[remotes.staging]` と書いたのに `link --project-ref stg-xxx` したら一致せず
- セクション名に typo（`[remote.staging]` は効かない）

### 対処

```bash
# Project Ref は Dashboard → Settings → General → Reference ID で確認
# または
supabase projects list
```

```toml
# ✅ 正（キーは任意、project_id が一致することが重要）
[remotes.staging]
project_id = "abcdefghij1234567890"

# ❌ typo
[remote.staging]  # s が抜けている
```

---

## 10. `supabase config push` が config.toml のコメントまで push する?

### 実際の挙動

- コメントは push されない（TOML パース後の値のみ Supabase に送信）
- 未指定キーは **Platform 側のデフォルト** に戻る（以前の Dashboard 設定は消える可能性あり）

### 対処

**すべての運用しているキーを `config.toml` に明示**。特に:
- `jwt_expiry` を 3600 のままにしたいなら、明示的に `jwt_expiry = 3600` と書く
- `rate_limit.*` もすべて列挙

---

## 11. Inbucket で送られたメールが見られない

### 原因

- `[inbucket] enabled = false` になっている
- `smtp_port` がコメントアウトされている
- Docker コンテナがクラッシュ

### 対処

```bash
# ログ確認
docker logs supabase_inbucket_<project_name>

# Web UI
open http://127.0.0.1:54324
```

---

## 12. `config.toml` が巨大すぎてレビューが困難

### 対処

- `[remotes.*]` 部分をファイル末尾に固める
- 変更のない section はコメントで区切る
- **PR で `supabase/config.toml` だけに変更を限定する PR ポリシー**

---

## 参照

- [Discussion #33604: config.toml in GitHub Actions](https://github.com/orgs/supabase/discussions/33604)
- [Supabase CLI troubleshooting](https://supabase.com/docs/guides/local-development/cli/getting-started)
