# Debugging Policy

**MANDATORY**: フロントエンド・バックエンドのデバッグは **devenv 2.0 の native process manager の TUI** を主インターフェースとして使用する。`devenv up` を対話端末で実行すると TUI が自動起動し、プロセス状態・リアルタイムログ・個別再起動がキーボード操作で完結する。process-compose は **撤去済み**。

## 対話環境（推奨）

```bash
devenv up                # dev サーバ群起動 → TUI が自動起動
# TUI 内で:
#   - プロセス一覧表示
#   - 個別プロセスのリアルタイムログ閲覧
#   - 個別プロセスの再起動
```

## 対象プロセス名

| プロセス名 | サービス | ポート |
|-----------|----------|-------|
| `backend` | FastAPI バックエンド（ローカル実行） | 4040 |
| `storybook` | Storybook | 6006 |
| `web` | Next.js (opt-in、`devenv up web` 必須) | 3000 |
| `mobile` | Expo Metro (opt-in、`devenv up mobile` 必須) | 8081 |

## 非対話環境（CI / AI エージェント）

TUI が使えないので、ログファイルを直接 tail する:

```bash
# devenv processes のログは /tmp/devenv-*/processes/logs/ 配下
tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log
tail -100 /tmp/devenv-*/processes/logs/storybook.stderr.log
tail -100 /tmp/devenv-*/processes/logs/web.stderr.log

# detached モード起動 → ログを後追い
devenv up -d
# 全プロセス停止
devenv processes down
```

## Amplify Backend のトラブルシューティング（ampx sandbox）

ローカルの Docker スタックは無い。バックエンドはクラウド上の per-dev sandbox。問題切り分けは以下:

```bash
# sandbox を watch 起動（デプロイログがそのまま流れる）。エラーはここに出る
sandbox

# sandbox を作り直したいとき
sandbox-delete
sandbox
```

よくある詰まりどころ:

| 症状 | 確認ポイント |
|------|-------------|
| `sandbox` がデプロイに失敗 / 権限エラー | **AWS 認証情報（プロファイル）** が有効か。`sandbox` / deploy には AWS creds が必須 |
| フロントが Cognito / AppSync / S3 に繋がらない | `amplify_outputs.json` が生成・最新化されているか（`sandbox` 実行で再生成）。手動編集しない |
| スキーマ変更が反映されない | `frontend/packages/backend/amplify/data/resource.ts` を保存後、`sandbox` の watch が再デプロイしたか |
| 認可エラー（403 等） | `a.model(...).authorization(...)` の宣言と、クライアントの認証状態（Cognito サインイン）が一致しているか |
| Lambda（FastAPI）が 5xx | CloudWatch Logs を確認（Amplify Console / AWS Console 経由） |

## 全停止

```bash
stop          # devenv プロセスを停止
```

> per-dev sandbox はクラウド上に残るため、不要になったら `sandbox-delete` で明示的に破棄する。

## 品質チェック

devenv の **scripts** (PATH 直結) を使用する。Makefile は **deprecated**（削除済み）。

```bash
lint
type-check
unit-test
ci-check
```

正典: `/.claude/CLAUDE.md`, `/.claude/skills/debugging/`
