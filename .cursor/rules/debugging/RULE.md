---
description: "Debugging policy: Use devenv 2.0 native process manager TUI for frontend/backend debugging"
alwaysApply: true
globs: []
---
# Debugging Policy

**MANDATORY**: フロントエンド・バックエンドのデバッグは **devenv 2.0 の native process manager の TUI** を主インターフェースとして使用する。`devenv up` を対話端末で実行すると TUI が自動起動し、プロセス状態・リアルタイムログ・個別再起動がキーボード操作で可能。process-compose は **撤去済み**。

## 対話環境（推奨）

```bash
devenv up                # 軽量セット起動 → TUI が自動起動
# TUI 内で:
#   - プロセス一覧表示
#   - 個別プロセスのリアルタイムログ閲覧
#   - 個別プロセスの再起動
#   - キーボード操作で完結
```

## 非対話環境（CI / Claude Code）

TUI が使えないので、ログファイルを直接 tail する:

```bash
# devenv processes のログは /tmp/devenv-*/processes/logs/ 配下
tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log
tail -100 /tmp/devenv-*/processes/logs/storybook.stderr.log
tail -100 /tmp/devenv-*/processes/logs/web.stderr.log     # devenv up web 起動時のみ

# detached モード起動 → ログを後追い
devenv up -d
# 全プロセス停止
devenv processes down
```

## 対象プロセス

| プロセス名 | サービス | ポート |
|-----------|----------|-------|
| `backend` | FastAPI バックエンド | 4040 |
| `storybook` | Storybook | 6006 |
| `web` | Next.js (opt-in、`devenv up web` 必須) | 3000 |
| `mobile` | Expo Metro (opt-in、`devenv up mobile` 必須) | 8081 |

## 全停止

```bash
devenv processes down   # detached で動いているプロセスを停止
```

## Amplify backend（ampx sandbox）の確認

ローカル Docker は無い。バックエンドは **per-dev のクラウド sandbox** なので、
確認先は sandbox のデプロイログと生成物・AWS 側のログになる。

```bash
sandbox                 # ampx sandbox（watch）。デプロイの失敗はここに出る
sandbox-once            # 1 回だけデプロイして終了（CI / 切り分け用）
sandbox-delete          # 壊れた sandbox を作り直すときはこれ → sandbox

cat frontend/packages/backend/amplify_outputs.json   # 生成されているか / どの環境を向いているか
aws sts get-caller-identity                          # AWS 認証情報が有効か
```

- **フレッシュな clone は `amplify_outputs.json` が無いので型チェック・ビルドが通らない**。
  まず `sandbox` か `ampx generate outputs` を実行する（意図的に gitignore してある）
- Lambda / AppSync の実行時ログは **CloudWatch Logs**（`/aws/lambda/<function>`）
- Amplify Data のエラーは throw されない。呼び出し側の `errors` を必ず見る

## UI の描画が壊れているとき

`build-storybook` の成功は描画を保証しない。`verify-storybook-render` で
実行時エラー・未翻訳キー・font-size を実測する（`/.claude/rules/ui-testing.md`）。

正本: `/.claude/CLAUDE.md`, `/.claude/skills/debugging/`
