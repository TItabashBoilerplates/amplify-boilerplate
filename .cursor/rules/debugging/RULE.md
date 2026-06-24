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
stop          # devenv プロセス + Supabase Docker を両方停止
supabase-stop # Supabase Docker のみ停止
```

## Supabase ログ確認（Docker）

Supabase は Supabase CLI が Docker で管理（devenv の native process supervisor は backend / storybook のみ監視）。

```bash
docker ps
docker logs -f supabase_db_<project_name>
docker logs -f supabase_auth_<project_name>
docker logs -f supabase_edge_runtime_<project_name>
```

正典: `/.claude/CLAUDE.md`, `/.claude/skills/debugging/`
