# Database Schema Guidelines

## ORM

- Drizzle ORM for schema definition
- pgPolicy for RLS policies

## Conventions

- UUID primary keys: `uuid_generate_v4()`
- Timestamps: `created_at`, `updated_at`

## Migration

User approval required for production. Local migration は AI 自動実行可。すべて devenv の **tasks** 経由で実行する。Makefile は **deprecated**（削除済み）。

```bash
# Local (AI 実行可)
devenv tasks run app:migrate-dev    # Generate + apply migration + 型生成（フルフロー）
devenv tasks run db:migrate-dev     # マイグレーション生成 + 適用のみ
devenv tasks run model:build        # 型のみ再生成

# Production (ユーザー承認必須)
devenv tasks run -P production db:migrate-deploy
```

正典: `/.claude/rules/commands.md`, `/.claude/rules/database.md`

## RLS

Define RLS policies using pgPolicy in schema files.
