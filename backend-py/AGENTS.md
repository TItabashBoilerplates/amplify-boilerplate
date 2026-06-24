# Backend Python Guidelines

## Architecture

- Clean Architecture layers (apps/api 内)
- SQLModel for sync implementation
- uv workspace モノレポ（`apps/{api,mcp}` + `packages/core`）

## Patterns

- Gateway pattern for DRY
- Type hints required
- 共有基盤 (logger / supabase client / 共通例外) は `packages/core` に集約
- サービス固有のドメイン (entity / 固有例外) は `apps/<service>/src/<service>/domain/`

## Formatting

- **Ruff format** for code formatting (replaces Black)
- **Ruff** for linting
- **MyPy** for type checking (strict mode)

設定は workspace root `backend-py/pyproject.toml` で一元管理。member 個別の設定は持たない。

## Commands

すべて devenv の **scripts** (PATH 直結) を使用する。Makefile は **deprecated**（削除済み）。直接 `uv run ruff` / `uv run mypy` / `uv run pytest` での実行は禁止。

```bash
lint-backend-py           # Ruff lint (workspace 全体, auto-fix)
format-backend-py         # Ruff format (workspace 全体, auto-fix)
type-check-backend-py     # MyPy (strict mode, workspace 全体)
test-backend-py           # pytest (workspace 全体)
```

正典: `/.claude/rules/commands.md`

## Auto-Generated

`apps/api/src/api/domain/entity/models.py` is auto-generated on container startup.
DO NOT edit manually.
