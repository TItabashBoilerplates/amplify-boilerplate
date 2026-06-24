---
description: "devenv command policy: Always use devenv scripts/tasks for development"
alwaysApply: true
globs: []
---
# Development Command Policy

**MANDATORY**: 開発タスクには必ず devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`) を使用すること。Makefile は **deprecated**（削除済み）。

## 必須コマンド

| 操作 | コマンド |
|------|---------|
| Lint | `lint`, `lint-frontend`, `lint-backend-py`, `lint-functions`, `lint-fsd` |
| Format | `format`, `format-frontend`, `format-backend-py`, `format-functions` |
| Type Check | `type-check`, `type-check-frontend`, `type-check-mobile`, `type-check-backend-py`, `check-functions` |
| Build | `build-frontend`, `build-storybook`, `build-mobile-ios`, `build-mobile-android` |
| Test | `test`, `test-frontend`, `test-backend-py`, `test-db` |
| CI | `ci-check` |
| Services | `devenv up`, `dev-web`, `dev-mobile`, `dev-all`, `stop` |
| Migration (local) | `devenv tasks run app:migrate-dev` |
| Migration (deploy) | `devenv tasks run -P production db:migrate-deploy` |
| Model 生成 | `devenv tasks run model:build` |

## 禁止されるコマンド

```bash
# DO NOT
cd frontend && bun run biome check --write
cd backend-py && uv run ruff check
npx tsc --noEmit
make lint                       # ❌ Makefile は削除済み

# USE INSTEAD (devenv scripts on PATH)
lint-frontend
lint-backend-py
type-check-frontend
```

## 許可される直接実行

- ファイル読み取り: `cat`, `ls`, `tree`
- Git操作: `git status`, `git diff` (読み取りのみ)
- パッケージ情報: `bun list`, `uv pip list`

正典: `/.claude/rules/commands.md`
