---
name: doppler
description: Doppler（シークレットマネージャ）の利用ガイダンス。doppler CLI（login / setup / run / secrets / upload）、devenv 2.0 への Doppler-first 統合（loadDopplerForConfig・profile→config 対応・ファイルフォールバック）、シークレットと非機密 config の分離、公式 Doppler MCP サーバ（read-write）、CI/CD の service token、env/.env.secrets からの移行についての質問に使用。シークレット・環境変数・.env 暗号化管理・トークン取り扱い・ローテーション・RBAC の実装支援を提供。
---

# Doppler スキル

このプロジェクトはシークレット管理に **Doppler** を採用している（**Doppler-first**）。
詳細なベストプラクティスは [references/best-practices.md](references/best-practices.md)、
完全移行手順は [references/migration-plan.md](references/migration-plan.md) を参照。

## CRITICAL: 最優先ルール

1. **シークレットと非機密を分離する**（本リポジトリの中核方針）:
   - **シークレット**（API キー・トークン・DB パスワード等）→ **Doppler が唯一のソース**。
     `.env.secrets` のファイルフォールバックは廃止済み。
   - **非機密の環境変数**（ローカル Supabase URL / backend URL / port / publishable key 等。
     `env/{backend,frontend,migration}/.env.<ENV>`）→ **ファイル管理**（`.env.local` はコミット可）
   - 「漏れても害がない設定値」だけをファイルに置く。機密はすべて Doppler。
2. **トークン・シークレットをコミットしない**。`.mcp.json` / `doppler.yaml` / `devenv.nix` の
   いずれにも `DOPPLER_TOKEN` や生のシークレットを書かない。
3. **本番（prd）への write はフェーズ制**（`.claude/rules/mcp-doppler.md`）。初期構築は full-access、
   本番フェーズは明示承認制。CI/本番ランタイムは **read-only の service token** を使い、CLI/Personal
   トークンは live 環境で使わない（作成者と同じ write 権限を持つ）。
4. **コマンドは devenv 経由**（`.claude/rules/commands.md`）。`doppler` は `pkgs.doppler` で PATH 上。
5. **エラーは握りつぶさない**（`.claude/rules/error-handling.md`）。シークレットは Doppler が
   唯一のソースで**ファイルフォールバックは廃止**。取得できない（未ログイン/未 setup/token 無し）
   場合は devenv shell が警告する（サイレントにしない。shell 自体は止めない）。

## Doppler 統合（このリポジトリの仕組み）

`devenv.nix` の `loadDopplerByEnv` が、`loadEnvFilesForEnv`（非機密 config: `env/<svc>/.env.$ENV`）
の**後**に呼ばれ、`$ENV` 対応の Doppler config から**シークレットを注入する**。**シークレットは
Doppler が唯一のソース**（`.env.secrets` フォールバックは廃止）。**明示フラグ（旧 DOPPLER_ENABLE）
は不要**。取得できなければ警告を出す（shell は止めない → `doppler login` を打てる）。

env ファイル（非機密 config）のロードも Doppler と同じく **`$ENV` 駆動**で `env/<svc>/.env.$ENV`
を読む。ディレクトリ構成・責務分離は `env/README.md` を参照。

**初期セットアップ（init）**:
- 明示コマンド **`init`**（devenv script）が初回の**対話**セットアップを行う＝`doppler login`
  （ブラウザ認証）+ `doppler setup`（project/config 紐付け）。開発開始前に一度だけ実行。
- **非対話**部分は `setup:doppler` task が supabase:start 等と同様にブートストラップ
  （`devenv shell` 進入時）に組み込まれ、`doppler setup --no-interactive` を idempotent に実行する。

**どの Doppler config を参照するかは環境変数 `ENV` で切り替わる**（deploy スクリプト
`scripts/supabase/*.sh` と同じ ENV 規約）。devenv profile（`-P`）は対応する `ENV` を export する。

| `ENV`（= devenv profile） | Doppler config | 挙動 |
|---|---|---|
| `local`（未設定の既定） | **ローカル紐付け config**（`doppler setup`／`doppler.yaml` → 推奨 `dev_personal`） | `--config` を付けず local scope。ローカルの環境変数を参照 |
| `dev`（`-P dev`） | `dev` | `--config dev` |
| `staging`（`-P staging`） | `stg` | `--config stg` |
| `production`（`-P production`） | `prd` | `--config prd` |
| その他 | `$ENV` をそのまま config 名に | `--config "$ENV"` |

```bash
# ローカル（ENV 未設定 = local）: login+setup 済みなら Doppler から取得、未済なら警告
devenv shell

# profile で環境切替（ENV=staging を export → Doppler stg をロード）
devenv shell -P staging -- <command>

# ENV を直接指定して Doppler config だけ切替（profile を使わない場合）
ENV=staging devenv shell -- <command>
```

> 取得成功時は `🔐 Doppler secrets loaded (...)`、失敗時は `⚠️ シークレット未ロード` を表示
> （フォールバック無し）。`local` は `--config` 無しで `doppler setup` の紐付け config を参照。

## CLI 基本

```bash
init                               # 初回セットアップ（doppler login + setup を対話実行）= 推奨入口
doppler login                      # 一度だけブラウザ認証（keyring 保存）
doppler setup                      # ローカルを project/config に紐付け（doppler.yaml 参照）
doppler setup --no-interactive     # doppler.yaml ベースで自動（CI/モノレポ）
doppler run -- <command>           # secrets を env 注入して実行
doppler-pull --config dev          # 取得確認（= doppler secrets download --no-file --format env）
doppler-import --config dev        # 移行: 現行 env/.env.secrets を Doppler に一括投入
doppler configure                  # 現在の紐付け確認（doppler-setup script でも表示）
```

`doppler-pull` / `doppler-import` / `doppler-setup` / `mcp-sync` は devenv script（PATH 上）。

## 移行（env/.env.secrets → Doppler）

最短フロー（詳細は [references/migration-plan.md](references/migration-plan.md)）:

```bash
doppler login
# doppler.yaml の <doppler-project> を実プロジェクト名に置換してから:
doppler setup                 # local を project + dev_personal に紐付け
doppler-import --config dev    # 現行の env/.env.secrets を dev root config に投入
devenv shell                  # "🔐 Doppler secrets loaded" を確認（警告が消える）
```

`setup:secrets` task と `.env.secrets` フォールバック・`.env.secrets.example` は撤去済み。
投入確認後、ローカルの `env/.env.secrets` は削除してよい。非機密の `.env.local` は対象外。

## MCP（公式 Doppler MCP サーバ・read-write）

`.mcp.json`（正本）に `@dopplerhq/mcp-server`（npx, read-write）を登録済み。
MCP 設定は `.mcp.json` を編集して `mcp-sync` で Codex/Cursor に投影する（Claude は直読）。

- **認証**: `npx @dopplerhq/mcp-server login`（keyring）。トークンは設定に書かない。
  非対話環境では `DOPPLER_TOKEN`（service token）を実行時注入。
- **スコープ**: `--project` / `--config` で絞れるが「エージェントが回避しない保証ではない」。
  **prd の write はフェーズ制**（初期構築=可 / 本番=承認制。`.claude/rules/mcp-doppler.md`）。
- 公式は「実験的・開発/評価用途」。read-write のため慎重に扱う。
- Antigravity の MCP はグローバル `~/.gemini/config/mcp_config.json`（リポジトリ管理外）。

## エージェントによるシークレット更新（ガバナンス）

エージェント（AI）が Doppler のシークレットを**作成・更新**する場合は、必ず `doppler` MCP を
使う（Bash の `doppler secrets set/delete` 直叩きは禁止）。完全なポリシーは
**`.claude/rules/mcp-doppler.md`**（MANDATORY）。書き込み許可は**フェーズ制**（書き込み前に
ルール冒頭の `PHASE:` を確認）:

| config | 初期構築（full-access） | 本番（protected） |
|---|---|---|
| `dev` / `dev_personal` | 可（一言示す） | 可（内容を一言示して実行） |
| `stg` | 可（一言示す） | 可（事前提示・確認） |
| `prd` | **可**（大きな変更/delete は確認） | **不可**（明示承認制） |

- 全フェーズ共通: **値をチャット/ログ/コミットに出さない**（キー名のみ）。delete/一括変更は要確認。
- **フェーズ切り替え（ローンチ時）**: ルールの `PHASE:` を `本番（protected）` に変更 ＋ エージェント
  認証を **dev/stg スコープの service token**（`DOPPLER_TOKEN`）に縮小して prd を物理的に締める。
  初期構築フェーズは全 config 書ける token（または keyring login）でよい。
- MCP が**未認証だとツールが出ない**。`npx @dopplerhq/mcp-server login` か `DOPPLER_TOKEN` を
  設定し、クライアントを再接続する。

## CI/CD・デプロイ（詳細は references/cicd.md）

デプロイは **各プラットフォーム（Vercel / Supabase / Railway）が GitHub 連携で直接ビルド**する
構成。シークレットは GitHub Actions ではなく **Doppler 公式ネイティブ連携（sync）で各プラット
フォームへ直接届ける**（3 つともネイティブ連携あり・ダッシュボード設定）。

- **Vercel / Railway / Supabase**: Doppler の Integrations で config → 各プラットフォームの
  env vars / secrets に自動 sync。config↔環境 = `prd`→Production / `stg`→Preview(Staging) / `dev`→Dev。
- **GitHub Actions CI**（`.github/workflows/ci.yml`）: lint/test のみで**シークレット不要**。
  必要時は read-only service token を GitHub Secrets `DOPPLER_TOKEN` に登録（CI は既に env で渡す）。
- 旧 `scripts/supabase/deploy-secrets.sh`（dotenvx）は廃止し Supabase ネイティブ連携に置換。

## ベストプラクティス要点（詳細は references/best-practices.md）

- **環境**: `dev` / `stg` / `prd` の root config。ローカルは **personal config（`dev_personal`）**。
- **継承**: 共通値は親 config に集約、環境差は子で上書き（Config Inheritance）。
- **トークン**: 本番/CI は **read-only・単一 config スコープの service token**。CLI/Personal は live 厳禁。
- **命名**: config はハイフン区切り小文字。secret キーは用途が分かる prefix。
- **運用**: 定期ローテーション、audit log を毎週確認、RBAC は最小権限（dev=Collaborator / prd=Viewer）。

## NG / DO

| ❌ NG | ✅ DO |
|---|---|
| `DOPPLER_TOKEN` を `.mcp.json` / `devenv.nix` にコミット | keyring ログイン or 実行時 env 注入 |
| 生シークレットをコードや `.env.local` に直書き | Doppler config に置き、devenv/`doppler run` で注入 |
| 非機密 URL/port まで Doppler に載せる | 非機密は `.env.local` のまま（責務分離） |
| CI で `doppler login`（user token） | read-only service token を `DOPPLER_TOKEN` で注入 |
| 本番フェーズで prd を勝手に write | フェーズ制に従う（本番は明示承認） |
| `doppler run` の失敗を握りつぶす | 失敗はログ + 停止（error-handling.md） |

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `⚠️ シークレット未ロード` 警告が出る | `doppler login` + `doppler setup`（CI は `DOPPLER_TOKEN`）。フォールバックは廃止済み |
| `you must provide a token` | 未ログイン。`doppler login`。CI なら `DOPPLER_TOKEN` 注入 |
| `doppler: command not found` | devenv shell 内で実行しているか（`pkgs.doppler`） |
| 値が古い/反映されない | Doppler が後勝ち。`doppler-pull --config <c>` で実値確認 |
| MCP のツールが出ない | `npx @dopplerhq/mcp-server login` 後にクライアント再接続 |

## チェックリスト

- [ ] シークレットのみ Doppler、非機密 `.env.local` はファイル（責務分離）
- [ ] トークン・シークレットを一切コミットしていない
- [ ] profile→config 対応が `devenv.nix` / `doppler.yaml` / 本 SKILL.md で一致
- [ ] CI/本番は read-only service token（CLI/Personal トークン不使用）
- [ ] シークレットは Doppler のみ（`.env.secrets` フォールバック廃止）。未ログイン時は警告が出る
- [ ] prd への write はフェーズ制に従う（本番フェーズは明示承認を経ている）

## 関連ドキュメント

- [references/cicd.md](references/cicd.md) — CI/CD・デプロイ（Vercel/Railway/Supabase ネイティブ連携・CI token）
- [references/best-practices.md](references/best-practices.md) — Doppler 公式ベストプラクティス
- [references/migration-plan.md](references/migration-plan.md) — 完全移行ランブック
- `.claude/rules/commands.md` / `mcp-supabase.md` / `error-handling.md` / `auto-generated.md`
- 公式: https://docs.doppler.com/docs/cli ／ MCP: https://docs.doppler.com/docs/mcp
