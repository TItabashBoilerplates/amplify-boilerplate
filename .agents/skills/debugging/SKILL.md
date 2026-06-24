# デバッグスキル

## CRITICAL: デバッグの主インターフェース — devenv 2.0 native process manager TUI

**フロントエンド・バックエンドのログ確認・状態確認・プロセス再起動は、devenv 2.0 の native process manager の TUI を主インターフェースとして使用する。** `devenv up` を対話端末で実行すると TUI が自動起動し、プロセス状態・リアルタイムログ・個別再起動がキーボード操作で完結する。

> **process-compose は撤去済み**（devenv 2.0 native がデフォルト）。`process-compose` コマンドは存在しない。

### 対話環境（推奨）

```bash
devenv up                # 軽量セット起動 → TUI が自動起動
# TUI 内で:
#   - プロセス一覧表示
#   - 個別プロセスのリアルタイムログ閲覧
#   - 個別プロセスの再起動
```

### 非対話環境（CI / AI エージェント）

TUI が使えないので、ログファイルを直接 tail する:

```bash
tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log
tail -100 /tmp/devenv-*/processes/logs/storybook.stderr.log
tail -100 /tmp/devenv-*/processes/logs/web.stderr.log

devenv up -d              # detached モード起動
devenv processes down     # 全プロセス停止
```

### 対象プロセス

| プロセス名 | サービス | ポート |
|-----------|----------|-------|
| `backend` | FastAPI バックエンド | 4040 |
| `storybook` | Storybook | 6006 |
| `web` | Next.js (opt-in、`devenv up web` 必須) | 3000 |
| `mobile` | Expo Metro (opt-in、`devenv up mobile` 必須) | 8081 |

---

## サービス構成

| サービス | 管理方法 | 起動コマンド |
|----------|----------|-------------|
| backend-py (FastAPI) | devenv 2.0 native process manager | `devenv up` |
| Storybook | devenv 2.0 native process manager | `devenv up` |
| Next.js (web) | devenv 2.0 native process manager (opt-in) | `dev-web` または `devenv up web` |
| Expo (mobile) | devenv 2.0 native process manager (opt-in) | `dev-mobile` または `devenv up mobile` |
| Supabase | Supabase CLI (Docker) | `supabase-start` (script) |

---

## 全停止

```bash
stop          # devenv プロセス + Supabase Docker を両方停止
supabase-stop # Supabase Docker のみ停止
```

---

## Supabase ログ確認（Docker）

```bash
docker ps
docker logs -f supabase_db_<project_name>
docker logs -f supabase_auth_<project_name>
docker logs -f supabase_edge_runtime_<project_name>
```

---

## 品質チェック

devenv の **scripts** (PATH 直結) を使用する。Makefile は **deprecated**（削除済み）。

```bash
lint           # 全プロジェクト lint (auto-fix)
format         # 全プロジェクト format (auto-fix)
type-check     # 型チェック
ci-check       # CI 用全チェック (lint + format-check + type-check)
test           # 全 unit test (frontend + backend-py)
```

---

## トラブルシューティング

### backend-py が起動しない

対話環境:
1. `devenv up` で TUI 起動 → backend のログを TUI 内で確認
2. TUI で backend を再起動

非対話環境:
1. `tail -100 /tmp/devenv-*/processes/logs/backend.stderr.log` でエラーログ確認
2. `stop && devenv up -d` で全停止 → 再起動

### ポートが使用中

```bash
lsof -i :4040   # Backend Python
lsof -i :3000   # Next.js
lsof -i :6006   # Storybook
lsof -i :54321  # Supabase API
kill -9 <PID>
```

正典: `/.claude/CLAUDE.md`, `/.claude/skills/debugging/`
