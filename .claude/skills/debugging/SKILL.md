---
name: debugging
description: デバッグ手順ガイダンス。プロセスログ確認、ampx sandbox / amplify_outputs.json / AWS 認証情報のトラブルシューティングについての質問に使用。devenv 2.0 が backend + Storybook を管理し、Amplify backend は ampx sandbox で独立管理する。devenv の TUI を主インターフェースとする。
---

# デバッグスキル

このプロジェクトのデバッグ方法を説明します。

## CRITICAL: デバッグの最優先手段 — devenv 2.0 TUI

**backend + Storybook の監視・ログ閲覧・再起動は、devenv 2.0 の native process manager が提供する TUI（Terminal UI）を使用する。** process-compose への依存は 2026-04 に完全撤去済み。

**Amplify backend は devenv 管理対象外**。AppSync/DynamoDB/Cognito/S3/Lambda は per-dev のクラウド sandbox にデプロイされる。起動・破棄は `ampx sandbox`（`sandbox` / `sandbox-once` / `sandbox-delete` script）で独立管理する。`ampx sandbox` は watch モードで動き、`amplify_outputs.json` を生成・更新し続けるため、長時間動かしっぱなしにする前提で devenv プロセスにはぶら下げず別ターミナルで動かす。

> ⚠️ `ampx sandbox` / デプロイには **AWS 認証情報（プロファイル）** が必要。未設定だと sandbox 起動が失敗する。

`devenv up` を対話端末で実行すると、Rust 製 native process manager の TUI が自動起動し、以下を一画面で扱える:

- 全プロセスの状態（pending / running / ready / failed）
- 各プロセスのリアルタイムログ
- 個別プロセスの再起動・起動・停止

devenv が管理するプロセスは以下の通り（Amplify sandbox は含まれない）:

1. `backend` — uvicorn 起動。`/healthcheck` 200 で ready。**前提として `amplify_outputs.json` が生成済みであること**（`ampx sandbox` を別ターミナルで先に起動しておく）
2. `storybook` — DB 非依存、独立起動。`/` 200 で ready

> Makefile は **deprecated**。`make X` は使わず devenv のコマンド（scripts または `devenv tasks run`）を使う。

### 実在する CLI サブコマンド

native manager は TUI が主なので、CLI サブコマンドは少ない。

| コマンド | 用途 |
|---------|------|
| `devenv up` | フォアグラウンド起動（TUI 付き、backend + storybook） |
| `devenv up <name>` | 指定プロセスのみ起動（例: `devenv up storybook`） |
| `devenv up -d` | バックグラウンド起動（TUI なし） |
| `devenv up --no-tui` | TUI を明示的に無効化（プレーンログ出力） |
| `devenv processes down` | detached で動いているプロセスを停止 |
| `devenv processes wait` | 全プロセスが ready になるまで待機（CI で使う） |
| `devenv up --strict-ports` | ポート衝突時に自動リトライせずエラー終了 |

**`devenv processes status/logs/restart` は存在しない**。これらの操作は TUI 内のキーボードで行う。

### 典型的なデバッグフロー

```bash
# 0. （別ターミナルで）Amplify backend sandbox を起動しておく
sandbox          # = ampx sandbox（watch + amplify_outputs.json 生成）

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
| Amplify backend（AppSync/DynamoDB/Cognito/S3/Lambda） | **devenv 外**（クラウド sandbox） | `sandbox` script（= `ampx sandbox`、別ターミナル） |
| backend-py (FastAPI) | devenv / native process manager (start.enable=true) | `devenv up`（軽量セットに含まれる） |
| Storybook | devenv / native process manager (start.enable=true) | `devenv up`（軽量セットに含まれる） |
| Next.js (web) | devenv / native process manager (start.enable=**false**) | `devenv up web` または `dev-web` script |
| Expo Metro (mobile, non-interactive) | devenv / native process manager (start.enable=**false**) | `devenv up mobile` または `dev-mobile` script |
| Expo TUI (対話的) | **devenv 外** | `mobile` / `mobile-ios` / `mobile-android` / `mobile-web` script (別ターミナル) |
| モノレポ全アプリ並列 | **devenv 外** | `frontend` script (`turbo dev`、重い) |
| 軽量起動 | — | `devenv up`（backend + storybook。Amplify backend は別途 `sandbox` を先に起動） |
| 軽量 + 個別アプリ | — | `dev-web` / `dev-mobile` / `dev-all`（preset script） |
| 任意組み合わせ | — | `devenv up backend storybook web` のように引数で指定 |
| 全停止 | — | `stop` script |

> `frontend/apps/<name>` 配下のアプリは **opt-in process** (`start.enable = false`) として登録されている。`devenv up` 単体では起動せず、明示指定または `dev-<name>` script を使う。新規アプリ追加時は `devenv.nix` の `frontendApps` attrset に 1 行追加するだけで連動する。

---

## サービス状態確認

```bash
# 主: TUI で俯瞰
devenv up

# 副: Amplify backend sandbox の状態（別ターミナルで動いている ampx sandbox のログを見る）
#     amplify_outputs.json が生成されていれば backend デプロイ成功の目安
ls -la frontend/amplify_outputs.json

# AWS 認証情報が有効か（sandbox / デプロイの前提）
aws sts get-caller-identity
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

#### 5. Amplify backend（sandbox / Lambda）単位

Amplify backend は devenv 外（クラウド sandbox）なので、デプロイ進行ログは `ampx sandbox` を動かしているターミナルで確認する。Lambda（FastAPI）の実行ログは CloudWatch Logs に出る（後述「Amplify backend ログ確認」を参照）。

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
- **Amplify backend 再デプロイ**: `ampx sandbox` を動かしていれば、`amplify/` の編集で自動再デプロイ（watch）。手動で 1 回だけなら `sandbox-once`。作り直しは `sandbox-delete` → `sandbox`（devenv とは独立）

`devenv up` を Ctrl-C で停止しても **クラウド sandbox は破棄されない**（独立管理のため）。sandbox を完全に破棄するには `sandbox-delete` を明示的に実行する。

---

## Amplify backend ログ確認（sandbox / Lambda / CloudWatch）

Amplify backend は devenv 外（クラウド sandbox）なので、ログの取り方は 2 系統ある。

1. **デプロイ進行ログ**: `ampx sandbox`（`sandbox` script）を動かしているターミナルにリアルタイム出力される。スキーマ反映や CDK デプロイのエラーはここで見る。
2. **Lambda（FastAPI）実行ログ**: 関数実行時の `print` / `logger` 出力は CloudWatch Logs に出る。

```bash
# Lambda 関数の CloudWatch Logs を tail（AWS CLI / プロファイル必須）
aws logs tail "/aws/lambda/<function_name>" --follow

# ロググループ名を探す
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/" \
  --query "logGroups[].logGroupName"
```

**主要な Amplify backend リソースと確認先**:

| サービス | ログ確認先 |
|----------|-----------|
| AppSync + DynamoDB（Data） | `ampx sandbox` ターミナル / CloudWatch（AppSync ロググループ） |
| Cognito（Auth） | CloudWatch（認証 trigger Lambda がある場合） |
| S3（Storage） | CloudTrail / S3 access logs |
| FastAPI Lambda（custom function） | `/aws/lambda/<function_name>` の CloudWatch Logs |

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

### DynamoDB（Amplify Data）へのデバッグ接続

Amplify Data のテーブルは DynamoDB 上にある。中身の確認は AWS CLI / コンソールから行う。

```bash
# sandbox がデプロイしたテーブル一覧
aws dynamodb list-tables --query "TableNames"

# 特定テーブルを scan（件数は絞る）
aws dynamodb scan --table-name <Model>-<apiId>-<env> --max-items 5
```

> フロントからのデータアクセスは `getDataClient().models.<Model>.list()/get()`（`@workspace/data-client`）。
> 認可は `amplify/data/resource.ts` の `allow.owner()` / `allow.authenticated()` 等で制御される（RLS の代替）。

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

## Amplify backend（sandbox）デバッグ

### 状態確認・再起動

```bash
# AWS 認証情報が有効か（前提）
aws sts get-caller-identity

# amplify_outputs.json が生成されているか（backend デプロイ成功の目安）
ls -la frontend/amplify_outputs.json

# sandbox を起動（watch + amplify_outputs.json 生成）
sandbox                 # = ampx sandbox（別ターミナル）

# 1 回だけデプロイして終了
sandbox-once
```

### sandbox リセット（作り直し）

```bash
# クラウド sandbox を破棄（データ消失注意）
sandbox-delete          # = ampx sandbox delete

# 再作成
sandbox
```

### Lambda（FastAPI custom function）デバッグ

```bash
# CloudWatch Logs を tail
aws logs tail "/aws/lambda/<function_name>" --follow

# API Gateway / 関数 URL 経由でエンドポイントを手動で叩く
#   Cognito JWT が必要なエンドポイントは Authorization: Bearer <idToken> を付ける
curl -i 'https://<api-id>.execute-api.<region>.amazonaws.com/<path>' \
  --header 'Authorization: Bearer <cognito_id_token>'
```

---

## 品質チェックコマンド

```bash
lint           # 全体の lint
format         # 全体の format
type-check     # 全体の型チェック
ci-check       # CI チェック（lint + format + type）
unit-test      # 全 unit test（frontend + backend-py）
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
2. **`amplify_outputs.json` が生成されているか確認**（backend は Cognito/AppSync 等の設定を参照するため、未生成だと起動失敗する）: `ls -la frontend/amplify_outputs.json`
3. 未生成なら別ターミナルで: `sandbox`（= `ampx sandbox`）。AWS 認証情報が無ければ `aws sts get-caller-identity` で先に確認
4. 個別再起動: TUI のキーバインド、または `devenv up` を一度止めてから再起動
5. Lambda 側のエラーは CloudWatch で: `aws logs tail "/aws/lambda/<function_name>" --follow`

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

kill -9 <PID>
```

> Amplify backend はクラウド sandbox（AppSync/DynamoDB/Cognito/S3/Lambda）なので、ローカルポートを占有しない。接続先は `frontend/amplify_outputs.json` に書かれる。

`devenv up --strict-ports` でポート衝突を即エラー化することも可能（デフォルトは自動で代替ポートを試す）。

### スキーマ / 認可エラー（Amplify Data）

```bash
# amplify/data/resource.ts を編集後、sandbox が watch で自動再デプロイする。
# デプロイ失敗時は ampx sandbox を動かしているターミナルのエラーを読む。

# 型が古い場合は amplify_outputs.json と @workspace/backend の Schema 型を再生成
sandbox-once    # = ampx sandbox（1 回デプロイして amplify_outputs.json / 型を更新）
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
