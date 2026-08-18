# Auto-Generated Files Policy

**CRITICAL**: 以下は自動生成されるため、絶対に手動編集しないこと。

正本: `/.claude/rules/auto-generated.md`

| ファイル | 生成元 | Git |
|---|---|---|
| `frontend/packages/backend/amplify_outputs.json` | `ampx`（`sandbox` / `ampx generate outputs`） | ❌ 追跡しない（環境固有） |
| `frontend/apps/{web,mobile}/amplify_outputs.json` | 上記へのシンボリックリンク（devenv） | ❌ 追跡しない |
| `frontend/apps/web/amplify_outputs.ci.json` | **手書き**のスタブ（公開情報のみ） | ✅ 追跡する（生成物ではない） |
| `frontend/packages/api-client/src/generated/` | Hey API（backend-py の OpenAPI から） | ✅ 追跡する |
| `.codex/config.toml` / `.cursor/mcp.json` | `mcp-sync`（正本は `.mcp.json`） | ✅ 追跡する |

> **`Schema` 型は生成ファイルではない。** `amplify/data/resource.ts` の `a.schema()` からの
> 型推論なので、編集するのは `resource.ts` 本体
> （`import type { Schema } from '@workspace/backend'`）。

## Correct workflow

1. Edit `frontend/packages/backend/amplify/**`（data / auth / storage / functions）
2. Apply with **`sandbox`**（型は推論なので生成コマンド不要）
3. API client: `pnpm run --filter @workspace/api-client generate`

## Prohibited

- 生成ファイルへの直接編集
- **`amplify_outputs.json` のコミット**（環境固有・他人の環境を壊す）
- **`amplify_outputs.ci.json` に秘匿値を入れる**（Git 追跡されている）

> A fresh clone has no `amplify_outputs.json`, so type-check / build fail until you run
> `sandbox` or `ampx generate outputs`. This is intentional.
