---
description: "Backend defaults to TypeScript Amplify Functions; Python (backend-py) is escalation-only"
alwaysApply: true
globs: ["frontend/packages/backend/**/*.ts", "backend-py/**/*.py"]
---
# Backend Architecture

**MANDATORY**: バックエンドの既定は **TypeScript の Amplify Functions**（Node `defineFunction`）。
Python（`backend-py`）は**特殊要件のときだけ**の escalation。

正本: `/.claude/rules/backend-architecture.md`

## 判断順

1. **Amplify Data で直接できないか**（CRUD・認可・リアルタイムは関数不要）
2. **Node `defineFunction`（TypeScript）** — `frontend/packages/backend/amplify/functions/<name>/`
   - REST は Hono（`hono/aws-lambda`）、MCP は `@hono/mcp`
   - 共有ロジックは `@workspace/backend-core`
3. **backend-py** — LLM/エージェント / 15 分超・重い処理 / Python 固有ライブラリ / 既存 Python 資産

トリガーが無ければ `backend-py/` を**一切触らない**のが正常。

## パッケージマネージャ

| 対象 | 使うもの |
|---|---|
| TypeScript / Node | **pnpm**（npm / yarn / **bun は禁止**。ampx が bun 非対応） |
| Python | **uv**（`uv add --package <member> <pkg>`） |
| CLI runner | `pnpm exec` / `pnpm dlx`（npx・bunx は使わない） |
