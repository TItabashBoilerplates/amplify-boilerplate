---
description: "Auto-generated files policy: Never manually edit generated files"
alwaysApply: true
globs: []
---
# Auto-Generated Files Policy

**CRITICAL**: 以下のファイルは自動生成されるため、絶対に手動編集しないこと。

## 自動生成ファイル一覧

| ファイル | 生成元 |
|---------|--------|
| `frontend/packages/types/schema.ts` | Supabase CLI |
| `supabase/functions/shared/types/supabase/schema.ts` | Supabase CLI |
| `backend-py/app/src/domain/entity/models.py` | sqlacodegen |

## 正しいワークフロー

すべて devenv の **tasks** (`devenv tasks run <name>`) を使用する。Makefile は **deprecated**（削除済み）。

1. **Drizzleスキーマを編集**: `drizzle/schema/*.ts`
2. **マイグレーション実行**: `devenv tasks run app:migrate-dev` (= migration + 型生成のフルフロー)
3. **型のみ再生成**: `devenv tasks run model:build`
4. **Backendモデル再生成**: `stop && devenv up` (コンテナ再起動時)

正典: `/.claude/rules/commands.md`, `/.claude/rules/database.md`

## 禁止事項

- 自動生成ファイルへの直接編集
- カスタムコードの追加
- ローカル変更のコミット

