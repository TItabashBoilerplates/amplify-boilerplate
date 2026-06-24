# Doppler 移行ランブック（Doppler-first → ファイル廃止）

目次:
1. 現状（Doppler-first・フォールバック付き）
2. 移行のゴール
3. 段階的移行ステップ
4. ローカル環境の扱い（確定）
5. CI/CD と本番ランタイム
6. デプロイスクリプトの置換
7. ロールバック

`SKILL.md`（CLI・devenv 統合・MCP）と `best-practices.md` を併せて読むこと。

## 1. 現状（Doppler 唯一のソース・フォールバック廃止）

すでに入っているもの:
- `pkgs.doppler`（devenv `packages`）
- `loadDopplerByEnv` ヘルパ（`$ENV` 駆動で Doppler config を選択。**シークレットは Doppler のみ**。
  取得できなければ警告を出す＝サイレントにしない。明示フラグ不要）
- `loadEnvFilesForEnv`（非機密 config の `env/<svc>/.env.$ENV` を `$ENV` 駆動でロード）
- `profiles`（dev→dev / staging→stg / production→prd）と base `enterShell`（ENV=local 既定）への配線
- `doppler.yaml` テンプレート（project 名はプレースホルダ、local は `dev_personal`）
- `.mcp.json` の公式 Doppler MCP（read-write）+ `mcp-sync`
- `doppler-setup` / `doppler-pull` / `doppler-import` script
- **`.env.secrets` フォールバックの撤去**: `loadEnvFilesForEnv` から secrets source を削除、
  `setup:secrets` task と `.env.secrets.example` を廃止（completed）

- **CI/CD のネイティブ連携化**: `setup:doppler`（init）追加、`ci.yml` に `DOPPLER_TOKEN` 配線、
  `scripts/supabase/deploy-secrets.sh`（dotenvx）撤去 → Supabase ネイティブ連携に置換（completed）。
  詳細は [cicd.md](cicd.md)。

**まだやっていないこと（要ユーザー操作）**:
- 実 Doppler project / config の作成・シークレット投入
- ローカル `env/.env.secrets` の削除（doppler-import で投入確認後）
- 各プラットフォーム連携の作成（Vercel / Railway / Supabase のダッシュボード設定）
- CI で secrets が必要になったら GitHub Secrets に `DOPPLER_TOKEN`（service token）を登録

## 2. 移行のゴール

- **シークレット**の単一ソース = Doppler。`env/.env.secrets` を最終的に廃止。
- **非機密 config**（ローカル Supabase URL / backend URL / port 等、`env/*/.env.local`）は
  **ファイル管理のまま**（Doppler に載せない）。← 確定方針（責務分離）。

## 3. 段階的移行ステップ

1. **棚卸し**: `env/.env.secrets` のキーを列挙（= Doppler に移すもの）。`.env.local` は対象外。
2. **Doppler project 作成**: project（単一 or service 別）と config（`dev`/`stg`/`prd`）を作る。
   `doppler.yaml` の `<doppler-project>` を実名へ置換。service 別なら `path:` 付きに拡張。
3. **ログイン & 紐付け**: `doppler login` → `doppler setup`（local を project + `dev_personal` に）。
4. **シークレット投入**: `doppler-import --config dev`（= `doppler secrets upload env/.env.secrets
   --config dev`）。stg/prd へは各環境の値を投入（dev を継承して差分のみ上書きでも可）。
5. **検証**: `devenv shell` で "🔐 Doppler secrets loaded" を確認し、`doppler-pull` の値と
   アプリ挙動が一致することを確認。`ci-check` / アプリ起動も green。
6. **ローカルファイルの後始末**: 投入確認後、ローカルの `env/.env.secrets` を削除する
   （loadEnvFilesForEnv からの source 除去・`setup:secrets`・`.env.secrets.example` 撤去は完了済み）。
7. **CI/本番**: §5 の service token 化、§6 のデプロイ置換。

各ステップは 1 コミット粒度で、検証（`devenv shell` + `ci-check` + アプリ起動）を挟む。

## 4. ローカル環境の扱い（確定）

- **シークレット**は Doppler の **personal config（`dev_personal`）** から取得（公式推奨。dev を
  継承し開発者ごとに専用・他人不可視）。`doppler.yaml` の local エントリで紐付ける。
- **非機密 config** は `env/*/.env.local`（ファイル）のまま。
- **フォールバックは廃止済み**なので、ローカルでもシークレットを使うには `doppler login` +
  `doppler setup` が必須（未接続だと shell 起動時に警告が出る）。

## 5. CI/CD と本番ランタイム

- **CI（GitHub Actions）**: user 認証は使わない。GitHub Secrets に **read-only service token**
  （単一 config スコープ）を置き、job に `DOPPLER_TOKEN` で注入。本リポジトリ CI は
  `devenv shell bash` 実行で `ci.yml` が既に `DOPPLER_TOKEN` を env で渡すので、`loadDopplerByEnv`
  が自動で拾う（token がスコープ config を決めるため `--config` 不要）。詳細は [cicd.md](cicd.md)。
- **本番ランタイム / コンテナ**: `pkgs.doppler` はコンテナビルドから除外（`!isBuilding`）。本番で
  ランタイム注入が必要なら、イメージに doppler を同梱し service token で `doppler run`、または
  起動前に env を materialize。Supabase Edge Functions は Supabase 側 secrets に sync する設計も可。

## 6. デプロイ（ネイティブ連携・completed）

シークレットは各プラットフォームの **Doppler 公式ネイティブ連携（sync）** で供給する。詳細・
ダッシュボード手順は [cicd.md](cicd.md)。`scripts/supabase/deploy-secrets.sh`（dotenvx）は撤去し、
`deploy.sh` は secrets を push しない（Supabase ネイティブ連携が sync）。残る dotenvx 依存
（link/config/buckets/functions の deploy スクリプト）の整理は別途。

## 7. ロールバック

フォールバックは廃止済みなので、Doppler 接続が前提。問題時:
- まず `doppler login` / `doppler setup` / `DOPPLER_TOKEN` の状態を確認（多くは未接続が原因）。
- ファイルベースに戻す必要があれば、フォールバック撤去コミットを revert して `.env.secrets`
  source（loadEnvFilesForEnv）と `setup:secrets` を復活させる。
