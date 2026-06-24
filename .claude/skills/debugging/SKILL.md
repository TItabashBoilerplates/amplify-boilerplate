---
name: debugging
description: デバッグ手順ガイダンス。プロセスログ確認、Supabase ローカル環境のトラブルシューティングについての質問に使用。devenv 2.0 が backend + Storybook を管理し、Supabase は CLI で独立管理する。devenv の TUI を主インターフェースとする。
---

# デバッグスキル

このプロジェクトのデバッグ方法を説明します。

## CRITICAL: デバッグの最優先手段 — devenv 2.0 TUI

**backend + Storybook の監視・ログ閲覧・再起動は、devenv 2.0 の native process manager が提供する TUI（Terminal UI）を使用する。** process-compose への依存は 2026-04 に完全撤去済み。

**Supabase は devenv 管理対象外**。Docker コンテナ群の起動・停止は Supabase CLI（`supabase-start` / `supabase-stop` script、または `devenv tasks run supabase:start` / `supabase:stop`）で独立管理する。devenv プロセスにぶら下げると trap・ready probe・依存順序などの管理が複雑になるため意図的に分離している。

ただし `devenv up` は `supabase:start` task を `before = [ "devenv:processes:backend" ]` で前置しているため、この 1 コマンドで Supabase → backend + storybook の順に立ち上がる。

`devenv up` を対話端末で実行すると、Rust 製 native process manager の TUI が自動起動し、以下を一画面で扱える:

- 全プロセスの状態（pending / running / ready / failed）
- 各プロセスのリアルタイムログ
- 個別プロセスの再起動・起動・停止

devenv が管理するプロセスは以下の通り（Supabase は含まれない）:

1. `backend` — uvicorn 起動。`/healthcheck` 200 で ready。**前提として Supabase が起動済みであること**（`supabase:start` task が自動で先行する）
2. `storybook` — DB 非依存、独立起動。`/` 200 で ready

> Makefile は **deprecated**。`make X` は使わず devenv のコマンド（scripts または `devenv tasks run`）を使う。

### 実在する CLI サブコマンド

native manager は TUI が主なので、CLI サブコマンドは少ない。

| コマンド | 用途 |
|---------|------|
| `devenv up` | フォアグラウンド起動（TUI 付き、Supabase も自動起動） |
| `devenv up <name>` | 指定プロセスのみ起動（例: `devenv up storybook`） |
| `devenv up -d` | バックグラウンド起動（TUI なし） |
| `devenv up --no-tui` | TUI を明示的に無効化（プレーンログ出力） |
| `devenv processes down` | detached で動いているプロセスを停止 |
| `devenv processes wait` | 全プロセスが ready になるまで待機（CI で使う） |
| `devenv up --strict-ports` | ポート衝突時に自動リトライせずエラー終了 |

**`devenv processes status/logs/restart` は存在しない**。これらの操作は TUI 内のキーボードで行う。

### 典型的なデバッグフロー

```bash
# 1. TUI で全プロセスの状態を俯瞰する
devenv up

# 2. TUI 上で問題プロセスを選択してログを確認する
#    （TUI のキーバインドでナビゲーション・再起動が可能）

# 3. 必要なら TUI を Ctrl-C で終了して再起動
devenv up
```

### TUI を使わない運用（CI / detached）

detached 起動した場合は TUI がないため、CLI での運用になる:

```bash
# detached で起動
devenv up -d

# 準備完了を待つ
devenv processes wait

# 停止
stop
```

ログは `.devenv/state/` 配下に保存されるが、レイアウトは manager 実装により変わり得るため、インタラクティブ確認には `devenv up`（フォアグラウンド + TUI）を使うのが確実。

---

## サービス構成

| サービス | 管理方法 | 起動コマンド |
|----------|----------|-------------|
| Supabase（Docker 群） | **devenv 外**（task で起動） | `supabase-start` script（または `devenv tasks run supabase:start`） |
| backend-py (FastAPI) | devenv / native process manager (start.enable=true) | `devenv up`（軽量セットに含まれる） |
| Storybook | devenv / native process manager (start.enable=true) | `devenv up`（軽量セットに含まれる） |
| Next.js (web) | devenv / native process manager (start.enable=**false**) | `devenv up web` または `dev-web` script |
| Expo Metro (mobile, non-interactive) | devenv / native process manager (start.enable=**false**) | `devenv up mobile` または `dev-mobile` script |
| Expo TUI (対話的) | **devenv 外** | `mobile` / `mobile-ios` / `mobile-android` / `mobile-web` script (別ターミナル) |
| モノレポ全アプリ並列 | **devenv 外** | `frontend` script (`turbo dev`、重い) |
| 軽量起動 | — | `devenv up`（Supabase + backend + storybook、`supabase:start` が `before` で自動先行起動） |
| 軽量 + 個別アプリ | — | `dev-web` / `dev-mobile` / `dev-all`（preset script） |
| 任意組み合わせ | — | `devenv up backend storybook web` のように引数で指定 |
| 全停止 | — | `stop` script |

> `frontend/apps/<name>` 配下のアプリは **opt-in process** (`start.enable = false`) として登録されている。`devenv up` 単体では起動せず、明示指定または `dev-<name>` script を使う。新規アプリ追加時は `devenv.nix` の `frontendApps` attrset に 1 行追加するだけで連動する。

---

## サービス状態確認

```bash
# 主: TUI で俯瞰
devenv up

# 副: Supabase コンテナの詳細状態
devenv shell -- supabase status
# direnv で local profile が有効なら直接 'supabase status' でもよい
```

---

## ログ確認

ログ閲覧の経路は 2 つある。**人間（対話端末）は TUI、エージェント（Claude Code 等の非対話環境）はログファイル直読**を使う。

### A. 対話端末からの確認（人間向け / メイン）

`devenv up` を起動して TUI 内でプロセスを選択 → リアルタイムログ。再起動も TUI のキーバインドで完結。

### B. 非対話環境からの確認（Claude Code / CI / detached / 他ターミナルから様子だけ見たいとき）

TUI は対話端末専用なので、Claude Code や CI からは触れない。代わりに **devenv が `/tmp/devenv-<hash>/processes/logs/` に書き出しているログファイルを直接読む**。

#### 1. プロセスが動いているかを確認

```bash
ps aux | grep -E "(devenv|uvicorn|storybook)" | grep -v grep
```

`devenv up` のプロセスが見えれば、その配下で backend / storybook も起動している。

#### 2. ログディレクトリの場所を特定

`.devenv/run` は `/tmp/devenv-<hash>/` へのシンボリックリンク。実体は `processes/logs/` 配下:

```bash
# シンボリックリンクで辿る
ls -la .devenv/run/                       # → /tmp/devenv-xxxxxxx/

# 直接 glob
ls -la /tmp/devenv-*/processes/logs/
```

各プロセスごとに stdout / stderr が分離されている:

```
backend.stdout.log     backend.stderr.log
storybook.stdout.log   storybook.stderr.log
```

> **注意**: `.devenv/state/` 直下にはプロセスログは置かれない（`prek.log` など別用途のみ）。プロセスログは必ず `/tmp/devenv-*/processes/logs/`。

#### 3. 読む順番

| 順 | 何を読むか | 理由 |
|---|---|---|
| 1 | `*.stderr.log` を **末尾**から（`tail -100`） | エラー・警告・トレースバックは大半がここ |
| 2 | `*.stdout.log` を **末尾**から | アプリ標準ログ・リクエストログ |
| 3 | 同じエラーが繰り返されていれば **再起動ループ** を疑う | devenv は失敗プロセスを自動再試行する |

先頭から読むと起動時の古いログで埋まる。`tail` か `Read` ツールの末尾オフセット指定で末尾優先で読む。

#### 4. 典型的なコマンド

```bash
# stderr の末尾だけ素早く確認
tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log
tail -100 /tmp/devenv-*/processes/logs/storybook.stderr.log

# 両方を時系列マージしたいときは別々に追う（同一ファイルではない）
tail -f /tmp/devenv-*/processes/logs/backend.stderr.log &
tail -f /tmp/devenv-*/processes/logs/backend.stdout.log
```

#### 5. Supabase コンポーネント単位

Supabase は devenv 外なので、各コンポーネントの本体ログは Docker から取る（後述「Supabase ログ確認」を参照）。

### 補足: detached 起動時の確認

`devenv up -d` で起動した場合は TUI なし。同じ `/tmp/devenv-*/processes/logs/` を直接 tail する。停止して TUI で見直したいなら:

```bash
devenv processes down
devenv up   # フォアグラウンド + TUI
```

---

## プロセス再起動

- **メイン**: TUI 内のキーバインドで個別再起動（backend / storybook）
- **全体再起動**: `devenv up` を Ctrl-C で停止 → 再度 `devenv up`
- **Supabase 再起動**: `supabase-stop && supabase-start`（devenv とは独立）

`devenv up` を Ctrl-C で停止しても **Supabase Docker コンテナは落ちない**（独立管理のため）。Supabase を完全に停止するには `supabase-stop` を明示的に実行するか、`stop`（devenv + Supabase をまとめて停止）を使う。

---

## Supabase ログ確認（Docker 個別コンテナ）

`supabase:start` task は `supabase start` のラッパーなので、Supabase の各コンポーネント（DB / Auth / Edge Functions など）のログは Docker コンテナを直接参照する。

```bash
# コンテナ名を確認
docker ps

# DB ログ
docker logs -f supabase_db_<project_name>

# Auth ログ（認証問題のデバッグ）
docker logs -f supabase_auth_<project_name>

# Edge Functions ログ
docker logs -f supabase_edge_runtime_<project_name>
```

**主要な Supabase コンテナ名**:

| サービス | コンテナ名（目安） |
|----------|-------------------|
| Supabase DB | `supabase_db_*` |
| Supabase Auth | `supabase_auth_*` |
| Supabase REST | `supabase_rest_*` |
| Supabase Edge Functions | `supabase_edge_runtime_*` |
| Supabase Studio | `supabase_studio_*` |

---

## backend-py 内でのデバッグ

```bash
# backend-py workspace ルートで Python REPL
cd backend-py
uv run --package api python

# 特定のスクリプトを実行
uv run --package api python -c "from core.logging import get_logger; print('OK')"

# テストを実行（workspace 全体）
uv run pytest -v

# 特定 member のテストのみ
uv run pytest apps/api/tests/ -v

# 依存関係の確認
uv pip list
```

### Supabase DB へのデバッグ接続

```bash
# PostgreSQL に接続（ポート 54322）
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# SQL 実行例
SELECT * FROM auth.users LIMIT 5;
\dt public.*
\q
```

---

## フロントエンドデバッグ

### Next.js (web)

web は devenv の **opt-in process** (`start.enable = false`)。`devenv up` 単体では起動しないが、明示指定すると devenv の TUI 内で管理される。

```bash
# Option 1: devenv 内 (TUI で管理、推奨)
devenv up web                    # web 単独
dev-web                          # = devenv up backend storybook web (推奨)
devenv up backend web            # 任意組み合わせ

# Option 2: devenv 外 (turbo dev、モノレポ全アプリ並列起動)
frontend                         # = cd frontend && turbo dev (重い)

# ブラウザで確認
# Next.js:   http://localhost:3000
# Storybook: http://localhost:6006（devenv 側）
```

devenv 内起動の場合、TUI で `web` プロセスを選択してリアルタイムログを見る。`frontend` script の場合はそれを実行したターミナルでログを直接確認。

### Storybook

Storybook は devenv 管理下。TUI の `storybook` プロセスを選択してログを見る。再起動も TUI のキーバインドから。

### ビルドエラーの確認

```bash
type-check-frontend
lint-frontend
build-frontend
```

---

## Supabase ローカル環境デバッグ

### 状態確認・再起動

```bash
# 状態確認
devenv shell -- supabase status
# direnv で local profile が active なら 'supabase status' のみで OK

# 停止 → 起動
# 1. TUI を Ctrl-C で止める
stop                    # devenv + Supabase 全停止
# 2. 再度起動
devenv up
```

### DB リセット

```bash
# ローカル DB を完全リセット（データ消失注意）
devenv shell -- supabase db reset

# マイグレーション再適用
devenv tasks run db:migrate-deploy
```

### Edge Functions デバッグ

```bash
# Edge Functions のログ確認
docker logs -f supabase_edge_runtime_<project_name>

# 特定の関数を手動で呼び出し
curl -i --location 'http://localhost:54321/functions/v1/<function_name>' \
  --header 'Authorization: Bearer <anon_key>'
```

---

## 品質チェックコマンド

```bash
lint           # 全体の lint
format         # 全体の format
type-check     # 全体の型チェック
ci-check       # CI チェック（lint + format + type）
test-db        # pgTAP（DB テスト）
e2e            # Maestro E2E（全プラットフォーム）
e2e-web        # Maestro E2E（Web）
e2e-mobile     # Maestro E2E（Mobile）
```

---

## トラブルシューティング

### backend が起動しない

1. ログ確認:
   - 対話端末: TUI で `backend` を選択
   - 非対話: `tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log` → `backend.stdout.log`
2. **Supabase が起動しているか確認**（backend は Supabase に接続するため、未起動だと起動失敗する）: `devenv shell -- supabase status`
3. Supabase が未起動なら: `supabase-start`
4. 個別再起動: TUI のキーバインド、または `devenv up` を一度止めてから再起動
5. supabase の health を直接叩く: `curl -sf http://localhost:54321/rest/v1/`

### Storybook が起動しない

`devenv` は失敗プロセスを自動再試行するので、ログには同じエラーが何度も書かれる。**末尾だけ読めば原因は特定できる**。

1. ログ確認:
   - 対話端末: TUI で `storybook` を選択
   - 非対話: `tail -100 /tmp/devenv-*/processes/logs/storybook.stdout.log`（webpack のビルドエラーは stdout 側に出ることが多い）と `storybook.stderr.log` の両方
2. よくある原因:
   - `.storybook/preview.tsx` の import 解決失敗（`@workspace/ui/...` 等のワークスペースエイリアス）
   - `packages/ui/package.json` の `exports` / `files` 不整合
   - story glob にマッチするファイルがない（致命ではないが警告として出る）
3. 修正後は TUI のキーバインドで再起動、または `devenv up` を一度止めて再起動

### Next.js (web) が起動しない

1. devenv 内起動 (`devenv up web` / `dev-web`) の場合: TUI で `web` プロセスを選択して stderr/stdout を確認、または `tail -100 /tmp/devenv-*/processes/logs/web.stderr.log`
2. devenv 外起動 (`frontend` script) の場合: 実行ターミナルでログを直接確認

```bash
# ポート 3000 が空いているか
lsof -i :3000

# 依存の再インストール（auto-setup が回らない場合）
cd frontend && bun install

# 直接起動（script の問題を排除）
cd frontend/apps/web && nr dev
```

### Mobile (Expo Metro) が起動しない

devenv 内起動 (`devenv up mobile` / `dev-mobile`) は **non-interactive Metro bundler** のみ。Expo の TUI（`r`, `i`, `a` 等のキーバインド）は使えないので、対話的に操作したい場合は `mobile-ios` / `mobile-android` を別ターミナルで叩く。

### ポートが使用中

```bash
lsof -i :4040   # backend (devenv)
lsof -i :3000   # Next.js web (devenv up web / dev-web / frontend)
lsof -i :6006   # Storybook (devenv)
lsof -i :8081   # Expo Metro (devenv up mobile / dev-mobile / mobile-*)
lsof -i :54321  # Supabase API (Docker, supabase-start)
lsof -i :54323  # Supabase Studio

kill -9 <PID>
```

`devenv up --strict-ports` でポート衝突を即エラー化することも可能（デフォルトは自動で代替ポートを試す）。

### マイグレーションエラー

```bash
# Drizzle スキーマ検証
drizzle-validate

# マイグレーション状態確認
cd drizzle && nr check
```

---

## ログレベル設定

### Backend Python

```bash
# env/backend/.env.local で設定
LOG_LEVEL=debug    # debug, info, warn, error
LOG_FORMAT=pretty  # pretty（開発）, json（本番）
```

### Frontend

```bash
# env/frontend/.env.local で設定
NEXT_PUBLIC_LOG_LEVEL=debug  # debug, info, warn, error
```

詳細は `.claude/skills/logger/SKILL.md` を参照。
